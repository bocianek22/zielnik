'use client';
import { useEffect, useState } from 'react';
import { appInfo, isNative } from '../components/native/bridge';

// Wersja zainstalowanej aplikacji natywnej (App.getInfo): przydatna przy zgłaszaniu błędów. W przeglądarce nic nie pokazuje.
export default function NativeVersion() {
  const [info, setInfo] = useState(null);
  useEffect(() => { if (isNative()) appInfo().then(setInfo); }, []);
  if (!info) return null;
  return <p className="muted native-version">Wersja aplikacji: {info.version}{info.build ? ` (${info.build})` : ''}</p>;
}
