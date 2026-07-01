import { App } from "@/App";
import { DataHealth } from "@/pages/DataHealth";
import { Leaderboard } from "@/pages/Leaderboard";
import { createBrowserRouter } from "react-router-dom";

/** React Router v7 route tree. */
export const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
    children: [
      { index: true, element: <Leaderboard /> },
      { path: "health", element: <DataHealth /> },
    ],
  },
]);
