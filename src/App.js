import {useState, useEffect} from 'react';
import { getAuth, signInWithCredential, GoogleAuthProvider } from "firebase/auth";
import { useUser } from 'reactfire';
import logo from './logo.svg';
import './App.css';

function App() {
  const auth = getAuth();
  const auth2 = (window).gapi.auth2.getAuthInstance()
  const { data: user } = useUser();
  const [googleCredentials, setGoogleCredentials] = useState(null);

  const [photos, setPhotos] = useState(0);
  const [albumCnt, setAlbumCnt] = useState(0);
  const [filter, setFilter] = useState('');

  const onGoogleSignedIn = (isSignedIn) => {
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
    auth2.isSignedIn.listen(onGoogleSignedIn)
    onGoogleSignedIn(auth2.isSignedIn.get())
  }, []);

  const signIn = () => {
    // if (auth2.isSignedIn.get()) {
    //   console.log('signed in already');
    //   return;
    // }
    auth2.signIn()
      .catch((err) => {
        console.log(err);
        auth.signOut();
      });
  };

  const signOut = () => {
    // if (!auth2.isSignedIn.get()) {
    //   console.log('not signed in');
    //   return;
    // }
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
      return;
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
      return;
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

  const download = () => {
    for (let i = 0; i < photos.length; i++) {
      window.open(getDownloadUrl(photos[i]));
    }
  };

  const onFilterChange = (event) => {
    setFilter(event.target.value);
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
          <button onClick={download}>Download All</button>
        </div>
      </div>
    </div>
  );
}

export default App;
