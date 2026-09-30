import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';
import { useAuth } from './lib/auth';
import Feed from './pages/Feed';
import Welcome from './pages/Welcome';

// Everything except the first screen loads on demand, so phones download less up front.
const AddItem = lazy(() => import('./pages/AddItem'));
const Blocked = lazy(() => import('./pages/Blocked'));
const Closet = lazy(() => import('./pages/Closet'));
const ClosetItemPage = lazy(() => import('./pages/ClosetItemPage'));
const EditProfile = lazy(() => import('./pages/EditProfile'));
const FitCheck = lazy(() => import('./pages/FitCheck'));
const MyProfile = lazy(() => import('./pages/MyProfile'));
const Notifications = lazy(() => import('./pages/Notifications'));
const PostPage = lazy(() => import('./pages/PostPage'));
const Report = lazy(() => import('./pages/Report'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const SavedOutfits = lazy(() => import('./pages/SavedOutfits'));
const Settings = lazy(() => import('./pages/Settings'));
const SignIn = lazy(() => import('./pages/SignIn'));
const SignUp = lazy(() => import('./pages/SignUp'));
const StyleMe = lazy(() => import('./pages/StyleMe'));
const UserPage = lazy(() => import('./pages/UserPage'));

function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading, recovering } = useAuth();
  if (loading) return <Spinner />;
  if (recovering) return <Navigate to="/reset-password" replace />;
  if (!session) return <Navigate to="/welcome" replace />;
  return children;
}

function PublicOnly() {
  const { session, loading } = useAuth();
  if (loading) return <Spinner />;
  if (session) return <Navigate to="/" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <Routes>
        <Route element={<PublicOnly />}>
          <Route path="/welcome" element={<Welcome />} />
          <Route path="/sign-in" element={<SignIn />} />
          <Route path="/sign-up" element={<SignUp />} />
        </Route>
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Feed />} />
          <Route path="/closet" element={<Closet />} />
          <Route path="/closet/new" element={<AddItem />} />
          <Route path="/closet/:id" element={<ClosetItemPage />} />
          <Route path="/style" element={<StyleMe />} />
          <Route path="/fit-check" element={<FitCheck />} />
          <Route path="/post/:id" element={<PostPage />} />
          <Route path="/u/:id" element={<UserPage />} />
          <Route path="/profile" element={<MyProfile />} />
          <Route path="/profile/edit" element={<EditProfile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/blocked" element={<Blocked />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/saved" element={<SavedOutfits />} />
          <Route path="/report" element={<Report />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
