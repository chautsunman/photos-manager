import React from 'react';
import ReactDOM from 'react-dom';
import { FirebaseAppProvider } from 'reactfire';
import './index.css';
import AppRoot from './AppRoot';
import reportWebVitals from './reportWebVitals';

const firebaseConfig = {
  apiKey: process.env.REACT_APP_apiKey,
  authDomain: process.env.REACT_APP_authDomain,
  projectId: process.env.REACT_APP_projectId,
  storageBucket: process.env.REACT_APP_storageBucket,
  messagingSenderId: process.env.REACT_APP_messagingSenderId,
  appId: process.env.REACT_APP_appId,
  measurementId: process.env.REACT_APP_measurementId
};

console.log('gapi', window.gapi);

const start = () => {
  window.gapi.auth2.init({
    client_id: process.env.REACT_APP_client_id,
    scope: 'https://www.googleapis.com/auth/photoslibrary.readonly'
  })

  console.log('start app');
  ReactDOM.render(
    <React.StrictMode>
      <FirebaseAppProvider firebaseConfig={firebaseConfig}>
        <AppRoot />
      </FirebaseAppProvider>
    </React.StrictMode>,
    document.getElementById('root')
  );
};

window.gapi.load('auth2', start);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
