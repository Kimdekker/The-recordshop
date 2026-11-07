// Global styles first: global.css defines the @layer order, before component CSS loads.
import './styles/global.css';
import './styles/components.css';
import './styles/pages.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import { AuthProvider } from './context/auth.tsx';
import Layout from './components/Layout.tsx';
import RequireUser from './components/RequireUser.tsx';
import Discover from './pages/Discover.tsx';
import AlbumPage from './pages/AlbumPage.tsx';
import ListenPage from './pages/ListenPage.tsx';
import CollectionPage from './pages/CollectionPage.tsx';
import DiaryPage from './pages/DiaryPage.tsx';
import Login from './pages/Login.tsx';
import ArtistPage from './pages/ArtistPage.tsx';
import NotFound from './pages/NotFound.tsx';
import ShelfPage from './pages/ShelfPage.tsx';

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <Discover /> },
      { path: 'discover/:shelf', element: <ShelfPage /> },
      { path: 'album/:id', element: <AlbumPage /> },
      { path: 'listen/:id', element: <ListenPage /> },
      { path: 'artist/:name', element: <ArtistPage /> },
      { path: 'login', element: <Login /> },
      {
        element: <RequireUser />,
        children: [
          { path: 'collection', element: <CollectionPage /> },
          { path: 'diary', element: <DiaryPage /> },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </StrictMode>,
);
