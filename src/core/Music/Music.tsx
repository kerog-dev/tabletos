import { useEffect, useRef, useState } from "react";
import { sdk } from "../../getsdk.ts";

const { fs, getAppDir } = sdk();

const appDir = await getAppDir("Music");
const playlistsDir = `${appDir}/playlists`;

if (!(await fs.isDir(playlistsDir))) await fs.mkdir(playlistsDir);

function PlaylistSelector({ setPlaylist }: { setPlaylist: (playlist: string | null) => void }) {
  const list = fs.useDirListing(playlistsDir);

  async function createPlaylist() {
    const name = prompt("Name of playlist?");
    if (!name) return;
    await fs.mkdir(`${playlistsDir}/${name}`);
  }

  return (
    <div>
      <ul>
        {list?.map(n => (
          <li key={n}>
            <button onClick={() => setPlaylist(n)}>{n}</button>
          </li>
        ))}
      </ul>
      <button onClick={() => createPlaylist()}>Create playlist</button>
    </div>
  );
}

interface Song {
  path: string;
  name: string;
}

function PlaylistPlayer({ playlistName }: { playlistName: string }) {
  const [songPaths, setSongPaths] = useState<string[]>([]);
  const songs: Song[] = songPaths.map(p => ({ path: p, name: p.split("/").at(-1)! }));
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [song, setSong] = useState<Song | null>(null);

  useEffect(() => {
    (async () => {
      const toCrawl: string[] = [`${playlistsDir}/${playlistName}`];
      const foundFiles = [];

      while (toCrawl.length > 0) {
        const p = toCrawl.shift()!;
        const list: ["dir" | "file", string][] = await Promise.all(
          (await fs.ls(p)).map(async name => [await fs.isDir(p + "/" + name) ? "dir" : "file", name]),
        );
        for (const [type, name] of list) {
          if (type === "file") foundFiles.push(`${p}/${name}`);
          else toCrawl.push(`${p}/${name}`);
        }
      }

      const AUDIO_EXTENSIONS = [
        ".mp3",
        ".wav",
        ".ogg",
        ".oga",
        ".m4a",
        ".aac",
        ".flac",
        ".wma",
        ".opus",
        ".weba",
        ".aiff",
        ".alac",
        ".mid",
        ".midi",
        ".amr",
        ".ac3",
      ];
      setSongPaths(foundFiles.filter(f => {
        for (const ext of AUDIO_EXTENSIONS) if (f.toLowerCase().endsWith(ext)) return true;
        return false;
      }));
    })();
  }, []);

  useEffect(() => {
    if (!audioRef.current) return;
    let url: string | null = null;
    let canceled = false;
    if (!song) audioRef.current.src = "";
    else {fs.readBlobFile(song.path).then(blob => {
        if (canceled) return;
        url = URL.createObjectURL(blob);
        if (audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.play();
        }
      });}
    return () => {
      canceled = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [song]);

  useEffect(() => {
    if (!audioRef.current) return;
    const audio = audioRef.current;
    const listener = () => {
      if (song) {
        setSong(songs[(songs.findIndex(s => s.path === song.path) + 1) % songs.length]);
        setTimeout(() => audio.play(), 100);
      }
    };
    audio.addEventListener("ended", listener);

    return () => audio.removeEventListener("ended", listener);
  }, [songPaths, song]);

  if (!songPaths) return <div>Playlist not found</div>;

  return (
    <div>
      <audio ref={audioRef} controls />
      <br />
      Songs:
      <ul>
        {songs.map(s => (
          <li key={s.path} title={s.path.replace(`${playlistsDir}/${playlistName}/`, "")}>
            {s.name} (<button onClick={() => setSong(s)}>Play</button>)
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Music() {
  const [playlist, setPlaylist] = useState<string | null>(null);

  if (!playlist) return <PlaylistSelector setPlaylist={setPlaylist} />;
  return <PlaylistPlayer playlistName={playlist} />;
}
