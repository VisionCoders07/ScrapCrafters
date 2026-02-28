// ============================================================
//  App.js  —  Root component, auth state, page router
//  Pages: landing | auth | artist | user | helper |
//         sold-donated | collaborations
// ============================================================
import React, { useState, useCallback } from "react";
import LandingPage      from "./pages/LandingPage";
import AuthPage         from "./pages/AuthPage";
import ArtistDashboard  from "./pages/ArtistDashboard";
import UserDashboard    from "./pages/UserDashboard";
import HelperDashboard  from "./pages/HelperDashboard";
import SoldDonatedPage  from "./pages/SoldDonatedPage";
import CollabsPage      from "./pages/CollabsPage";
import LoadingSpinner   from "./components/common/LoadingSpinner";
import useAuth          from "./hooks/useAuth";
import "./styles/index.css";

const App = () => {
  const [currentPage, setCurrentPage] = useState("landing");
  const auth = useAuth();

  const navigate = useCallback((page) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  // After login, go to the role dashboard
  const handleAuthSuccess = useCallback((user) => {
    navigate(user.role); // "artist" | "user" | "helper"
  }, [navigate]);

  const handleLogout = useCallback(() => {
    auth.logout();
    navigate("landing");
  }, [auth, navigate]);

  // Shared props for all dashboard pages
  const dashProps = { user: auth.user, onNavigate: navigate, onLogout: handleLogout };

  // Show spinner while rehydrating token on first load
  if (auth.user && currentPage === "landing") {
    // If user already logged in and lands on root, go to their dashboard
    setTimeout(() => navigate(auth.user.role), 0);
  }

  const pages = {
    landing:        <LandingPage onNavigate={navigate} />,
    auth:           <AuthPage onNavigate={navigate} onAuthSuccess={handleAuthSuccess} auth={auth} />,

    // Role dashboards — each gets the authenticated user object
    artist:         auth.user ? <ArtistDashboard  {...dashProps} /> : <AuthPage onNavigate={navigate} onAuthSuccess={handleAuthSuccess} auth={auth} />,
    user:           auth.user ? <UserDashboard    {...dashProps} /> : <AuthPage onNavigate={navigate} onAuthSuccess={handleAuthSuccess} auth={auth} />,
    helper:         auth.user ? <HelperDashboard  {...dashProps} /> : <AuthPage onNavigate={navigate} onAuthSuccess={handleAuthSuccess} auth={auth} />,

    // Shared pages — visible to all logged-in users
    "sold-donated":     auth.user ? <SoldDonatedPage  {...dashProps} /> : <AuthPage onNavigate={navigate} onAuthSuccess={handleAuthSuccess} auth={auth} />,
    "collaborations":   <CollabsPage onNavigate={navigate} onLogout={handleLogout} user={auth.user} />,
  };

  return (
    <div className="page-enter" key={currentPage}>
      {pages[currentPage] ?? <LandingPage onNavigate={navigate} />}
    </div>
  );
};

export default App;
