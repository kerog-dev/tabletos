import { getServerIp } from "../discovery.ts";
import { useState } from "react";
import "./MediaClient.css";

const ip = await getServerIp();

async function getAvailableVideos(): Promise<{ id: number; name: string }[]> {
  return await (await fetch(`http://${ip}:8484/videos`)).json();
}

const videos = await getAvailableVideos();

export default function MediaClient({}) {
  const [selectedVideo, setSelectedVideo] = useState<number | undefined>(
    undefined,
  );
  if (!selectedVideo)
    return (
      <div>
        <ul>
          {videos.map((video) => (
            <li key={video.id}>
              <button onClick={() => setSelectedVideo(video.id)}>
                {video.name}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  return (
    <div style={{ height: "100vh" }}>
      <video
        src={`http://${ip}:8484/video/${selectedVideo}`}
        className="video"
        controls
      ></video>
    </div>
  );
}
