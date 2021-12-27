import {useState, useEffect, useCallback, useMemo} from 'react';
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
  const [albums, setAlbums] = useState([]);
  const [sharedAlbums, setSharedAlbums] = useState([]);
  const [filter, setFilter] = useState('');
  const [lastFilterType, setLastFilterType] = useState(null);
  const [lastFilter, setLastFilter] = useState('');
  const [getPhotosPageToken, setGetPhotosPageToken] = useState(null);
  const [lastGetAlbumPhotosAlbumId, setLastGetAlbumPhotosAlbumId] = useState(null);
  const [getAlbumPhotosPageToken, setGetAlbumPhotosPageToken] = useState(null);

  const [downloadedPhotos, setDownloadedPhotos] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const PAGE_SIZE = 20;

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

  const getApi = useCallback(async (apiPath, urlParams, options) => {
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
  }, [googleCredentials]);

  const postApi = useCallback(async (apiPath, data, options) => {
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
  }, [googleCredentials]);

  const mergeFilter = useCallback((filter, pageToken, pageSize=PAGE_SIZE) => {
    if (pageToken) {
      return {
        ...filter,
        pageSize: pageSize,
        pageToken: pageToken
      };
    } else {
      return {
        ...filter,
        pageSize: pageSize
      };
    }
  }, []);

  const _listAlbums = useCallback(async (api, albumsPropName, cb) => {
    try {
      const urlParams = new URLSearchParams();
      const res = await getApi(api, urlParams, {});
      const parsedRes = await res.json();
      console.log(parsedRes);
      cb(parsedRes[albumsPropName]);
    } catch (err) {
      console.log(err);
    }
  }, [getApi]);
  const listAlbums = useCallback(() => _listAlbums('https://photoslibrary.googleapis.com/v1/albums', 'albums', setAlbums), [_listAlbums, setAlbums, setGetAlbumPhotosPageToken]);
  const listSharedAlbums = useCallback(() => _listAlbums('https://photoslibrary.googleapis.com/v1/sharedAlbums', 'sharedAlbums', setSharedAlbums), [_listAlbums, setSharedAlbums]);

  const getDateFilter = useCallback((pageToken) => {
    const filterSplit = filter.split('-');
    return mergeFilter({
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
    }, pageToken);
  }, [filter, mergeFilter]);

  const getAlbumFilter = useCallback((albumId, pageToken) => {
    return mergeFilter({
      albumId: albumId
    }, pageToken);
  }, [mergeFilter]);

  const pageToken = useMemo(() => {
    switch (lastFilterType) {
      case 'date':
        return getPhotosPageToken;
      case 'album':
        return getAlbumPhotosPageToken;
      default:
        return null;
    }
  }, [lastFilterType, getPhotosPageToken, getAlbumPhotosPageToken]);

  const _getPhotoList = useCallback(async (queryFilter, filterChanged, setPageTokenCb) => {
    console.log(queryFilter, `filterChanged: ${filterChanged}`);
    try {
      const res = await postApi(`https://photoslibrary.googleapis.com/v1/mediaItems:search`, queryFilter, {});
      const parsedRes = await res.json();
      console.log('get photos res', parsedRes);
      if (parsedRes && parsedRes.mediaItems) {
        if (filterChanged) {
          setPhotos(parsedRes.mediaItems);
        } else {
          setPhotos([...photos, ...parsedRes.mediaItems]);
        }
        if (parsedRes.nextPageToken) {
          setPageTokenCb(parsedRes.nextPageToken);
        } else {
          setPageTokenCb(null);
        }
      }
    } catch (err) {
      console.log(err);
    }
  }, [postApi, photos, setPhotos]);
  const getPhotos = useCallback(() => {
    console.log('get photos');
    const filterTypeChanged = lastFilterType !== 'date';
    let filterChanged;
    let finalPageToken;
    if (!filterTypeChanged && filter === lastFilter) {
      filterChanged = false;
      if (pageToken) {
        finalPageToken = pageToken;
      } else {
        console.log('got all photos');
        return;
      }
    } else {
      filterChanged = true;
      finalPageToken = null;
    }
    _getPhotoList(getDateFilter(finalPageToken), filterChanged, setGetPhotosPageToken);
    setLastFilterType('date');
    setLastFilter(filter);
  }, [_getPhotoList, getDateFilter, filter, lastFilterType, setLastFilterType, lastFilter, setLastFilter, pageToken, setGetPhotosPageToken]);
  const getAlbumPhotos = useCallback((albumId) => {
    console.log('get album photos', albumId);
    const filterTypeChanged = lastFilterType !== 'album';
    let filterChanged;
    let finalPageToken;
    if (!filterTypeChanged && albumId === lastGetAlbumPhotosAlbumId) {
      filterChanged = false;
      if (pageToken) {
        finalPageToken = pageToken;
      } else {
        console.log('got all photos');
        return;
      }
    } else {
      filterChanged = true;
      finalPageToken = null;
    }
    _getPhotoList(getAlbumFilter(albumId, finalPageToken), filterChanged, setGetAlbumPhotosPageToken);
    setLastFilterType('album');
    setLastGetAlbumPhotosAlbumId(albumId);
  }, [_getPhotoList, getAlbumFilter, lastFilterType, setLastFilterType, lastGetAlbumPhotosAlbumId, setLastGetAlbumPhotosAlbumId, pageToken, setGetAlbumPhotosPageToken]);

  const getNextPagePhotos = useCallback((e) => {
    switch (lastFilterType) {
      case 'date':
        getPhotos();
        break;
      case 'album':
        getAlbumPhotos(lastGetAlbumPhotosAlbumId);
        break;
      default:
        break;
    }
  }, [getPhotos, getAlbumPhotos, lastFilterType, lastGetAlbumPhotosAlbumId]);

  const getDownloadUrl = useCallback((photo) => {
    return `${photo.baseUrl}=d`;
  }, []);

  const getDownloadCommand = useCallback((photo) => {
    return `curl ${getDownloadUrl(photo)} --output ${photo.filename}`;
  }, [getDownloadUrl]);

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
          <span>Number of albums: {albums.length}</span>
        </div>
        <div>
          {albums.map((album) => (
            <div key={album.id}>{album.title} ({album.mediaItemsCount} Photos) <button onClick={() => getAlbumPhotos(album.id)}>Get Photos</button></div>
          ))}
        </div>
        <div>
          <button onClick={listSharedAlbums}>List Shared Albums</button>
          <span>Number of shared albums: {sharedAlbums.length}</span>
        </div>
        <div>
          {sharedAlbums.map((album) => (
            <div key={album.id}>{album.title} ({album.mediaItemsCount} Photos) <button onClick={() => getAlbumPhotos(album.id)}>Get Photos</button></div>
          ))}
        </div>
        <div>
          <input type="text" value={filter} onChange={onFilterChange}/>
          <button onClick={getPhotos}>Get Photos</button>
        </div>
        <div>
          <span>lastFilterType: {lastFilterType}, pageToken: {pageToken}</span>
          {pageToken && getNextPagePhotos && <button onClick={getNextPagePhotos}>Next page</button>}
        </div>
        <div>
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
          {downloadCommands.map(downloadCommand => <p key={downloadCommand}>{downloadCommand}</p>)}
        </div>
        <div>Error msg: {errorMsg}</div>
      </div>
    </div>
  );
}

export default App;
