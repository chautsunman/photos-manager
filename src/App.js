import {useState, useEffect} from 'react';
import { getAuth, signInWithCredential, GoogleAuthProvider } from "firebase/auth";
import { useUser } from 'reactfire';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import logo from './logo.svg';
import './App.css';

function App() {
  const auth = getAuth();
  const auth2 = (window).gapi.auth2.getAuthInstance()
  const { data: user } = useUser();
  const [googleCredentials, setGoogleCredentials] = useState(null);

  const [photos, setPhotos] = useState([]);
  const [albumCnt, setAlbumCnt] = useState(0);
  const [filter, setFilter] = useState('');

  const [downloadedPhotos, setDownloadedPhotos] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const onGoogleSignedIn = (isSignedIn) => {
    console.log('onGoogleSignedIn', isSignedIn);
    if (isSignedIn) {
      const currentUser = auth2.currentUser.get();
      const profile = currentUser.getBasicProfile();
      console.log('gapi: user signed in!', {
        name: profile.getName(),
        imageURL: profile.getImageUrl(),
        email: profile.getEmail(),
      });
      const authResponse = currentUser.getAuthResponse(true);
      const credential = GoogleAuthProvider.credential(
        authResponse.id_token,
        authResponse.access_token
      );
      signInWithCredential(auth, credential)
        .then(({ user }) => {
          console.log('firebase: user signed in!', {
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
          });
        });
      setGoogleCredentials(credential);
    } else {
      console.log('gapi: user is not signed in');
    }
  };

  useEffect(() => {
    auth2.isSignedIn.listen(onGoogleSignedIn);
    onGoogleSignedIn(auth2.isSignedIn.get());
  }, []);

  const signIn = () => {
    auth2.signIn()
      .catch((err) => {
        console.log(err);
        auth.signOut();
      });
  };

  const signOut = () => {
    auth2.signOut()
      .then(() => {
        console.log('gapi: sign out complete');
      })
      .then(() => {
        return auth.signOut();
      })
      .then(() => {
        console.log('firebase: sign out complete');
      })
      .catch((err) => {
        console.log(err);
        return auth.signOut();
      });
  };

  const getApi = async (apiPath, urlParams, options) => {
    if (!googleCredentials) {
      console.log('google credentials is not set');
      return Promise.reject();
    }
    return fetch(`${apiPath}?${urlParams.toString()}`, {
      ...options,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${googleCredentials.accessToken}`
      }
    })
  };

  const postApi = async (apiPath, data, options) => {
    if (!googleCredentials) {
      console.log('google credentials is not set');
      return Promise.reject();
    }
    return fetch(apiPath, {
      ...options,
      method: 'POST',
      mode: 'cors',
      cache: 'no-cache',
      credentials: 'same-origin',
      headers: {
        'Authorization': `Bearer ${googleCredentials.accessToken}`,
        'Content-Type': 'application/json'
      },
      redirect: 'follow',
      referrerPolicy: 'no-referrer',
      body: JSON.stringify(data)
    });
  };

  const listAlbums = async () => {
    try {
      const urlParams = new URLSearchParams();
      const res = await getApi(`https://photoslibrary.googleapis.com/v1/albums`, urlParams, {});
      const parsedRes = await res.json();
      console.log(parsedRes);
      setAlbumCnt(parsedRes.mediaItems.length);
    } catch (err) {
      console.log(err);
    }
  };

  const getPhotoList = async () => {
    const filterSplit = filter.split('-');
    try {
      const queryFilter = {
        "filters": {
          "dateFilter": {
            "ranges": [
              {
                "startDate": {
                  "year": filterSplit[0],
                  "month": filterSplit[1],
                  "day": filterSplit[2]
                },
                "endDate": {
                  "year": filterSplit[3],
                  "month": filterSplit[4],
                  "day": filterSplit[5]
                }
              }
            ]
          }
        }
      };
      console.log(queryFilter);
      const res = await postApi(`https://photoslibrary.googleapis.com/v1/mediaItems:search`, queryFilter, {});
      const parsedRes = await res.json();
      console.log(parsedRes);
      setPhotos(parsedRes.mediaItems);
    } catch (err) {
      console.log(err);
    }
  };

  const getDownloadUrl = (photo) => {
    return `${photo.baseUrl}=d`;
  };

  const getDownloadCommand = (photo) => {
    return `curl ${getDownloadUrl(photo)} --output ${photo.filename}`;
  };

  const download = async () => {
    // setDownloadedPhotos(0);
    // setDownloading(true);
    // let photosZip = new JSZip();
    // for (let i = 0; i < photos.length; i++) {
    //   console.log(`download photo ${i}`);
    //   try {
    //     const photoBlob = await fetch(getDownloadUrl(photos[i]), {
    //       mode: 'no-cors'
    //     }).then(res => res.blob());
    //     photosZip.file(photos[i].filename, photoBlob);
    //     setDownloadedPhotos(oldDownloadedPhotos => oldDownloadedPhotos + 1);
    //   } catch (err) {
    //     console.log(`download photo ${i} err`, err);
    //   }
    //   console.log(`downloaded photo ${i}`);
    // }
    // photosZip.generateAsync({type: 'blob'})
    //     .then((zipContent) => {
    //       saveAs(zipContent, 'photos.zip');
    //     })
    //     .catch((err) => {
    //       console.log('download photos err', err);
    //       setErrorMsg(err);
    //     })
    //     .then(() => {
    //       setDownloading(false);
    //     });
  };

  const onFilterChange = (event) => {
    setFilter(event.target.value);
  };

  const getPreviewUrl = (photo) => {
    return `${photo.baseUrl}=w200-h200`;
  };

  function fallbackCopyTextToClipboard(text) {
    var textArea = document.createElement("textarea");
    textArea.value = text;

    // Avoid scrolling to bottom
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";

    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
      var successful = document.execCommand('copy');
      var msg = successful ? 'successful' : 'unsuccessful';
      console.log('Fallback: Copying text command was ' + msg);
    } catch (err) {
      console.error('Fallback: Oops, unable to copy', err);
    }

    document.body.removeChild(textArea);
  }

  const downloadCommands = photos.map(photo => getDownloadCommand(photo));

  const copyDownloadCommands = () => {
    fallbackCopyTextToClipboard(downloadCommands.join('\n'));
    console.log('copied download commands');
  };

  const downloadDownloadCommands = () => {
    const downloadCommandsBlob = new Blob([downloadCommands.join('\n')], {type: 'text/plain;charset=utf-8'});
    saveAs(downloadCommandsBlob, 'download_photos.sh');
  };

  return (
    <div className="App">
      <h1>Photos Manager</h1>
      <div>
        <div>
          <button onClick={signIn}>Sign In</button>
          <button onClick={signOut}>Sign Out</button>
          <span>UID: {user?.uid}</span>
        </div>
        <div>
          <button onClick={listAlbums}>List Albums</button>
          <span>Number of albums: {albumCnt}</span>
        </div>
        <div>
          <input type="text" value={filter} onChange={onFilterChange}/>
          <button onClick={getPhotoList}>Get Photos</button>
          <span>Number of photos: {photos.length}</span>
          {!downloading && <button onClick={download}>Download All</button>}
          {downloading && <span>Downloading {downloadedPhotos}/{photos.length} photos</span>}
        </div>
        <div>
          <div>First photo (idx: 0)</div>
          {photos.length && <img src={getPreviewUrl(photos[0])}/>}
        </div>
        <div>
          <div>Last photo (idx: {photos.length - 1})</div>
          {photos.length && <img src={getPreviewUrl(photos[photos.length - 1])}/>}
        </div>
        <div>
          <div>Commands to download photos</div>
          <button onClick={copyDownloadCommands}>Copy commands</button>
          <button onClick={downloadDownloadCommands}>Download shell script</button>
          {downloadCommands.map(downloadCommand => <p>{downloadCommand}</p>)}
        </div>
        <div>Error msg: {errorMsg}</div>
      </div>
    </div>
  );
}

export default App;
