import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { useSyncExternalStore } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/contexts/AuthContext";

// Custom hash location hook that strips query params from the path so
// that routes like /accept-invite still match when the URL is
// /#/accept-invite?token=xxx  (query string is inside the hash fragment)
const listeners: Array<() => void> = [];
const onHashChange = () => listeners.forEach((cb) => cb());
const subscribeHash = (cb: () => void) => {
  if (listeners.push(cb) === 1) addEventListener("hashchange", onHashChange);
  return () => {
    const i = listeners.indexOf(cb);
    if (i > -1) listeners.splice(i, 1);
    if (!listeners.length) removeEventListener("hashchange", onHashChange);
  };
};
// Return only the path part (before ?) so route matching works correctly
const getHashPath = () => {
  const hash = location.hash.replace(/^#?\/?/, "");
  return "/" + hash.split("?")[0];
};
const useCleanHashLocation = (): [string, (to: string, opts?: any) => void] => {
  const path = useSyncExternalStore(subscribeHash, getHashPath, () => "/");
  // Navigate by setting the hash — ensures /#/path format
  const navigate = (to: string, opts?: any) => {
    const newHash = to.startsWith("/") ? to : "/" + to;
    if (opts?.replace) {
      history.replaceState(null, "", location.pathname + location.search + "#" + newHash);
      dispatchEvent(new HashChangeEvent("hashchange"));
    } else {
      location.hash = newHash;
    }
  };
  return [path, navigate];
};

import LoginPage from "@/pages/LoginPage";
import AcceptInvitePage from "@/pages/AcceptInvitePage";
import DashboardPage from "@/pages/DashboardPage";
import RequestLeavePage from "@/pages/RequestLeavePage";
import MyRequestsPage from "@/pages/MyRequestsPage";
import ApprovalsPage from "@/pages/ApprovalsPage";
import TeamOverviewPage from "@/pages/TeamOverviewPage";
import TeamCalendarPage from "@/pages/TeamCalendarPage";
import PeoplePage from "@/pages/PeoplePage";
import SettingsPage from "@/pages/SettingsPage";
import AuditLogPage from "@/pages/AuditLogPage";
import Layout from "@/components/Layout";
import ProtectedRoute from "@/components/ProtectedRoute";

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router hook={useCleanHashLocation}>
          <Switch>
            <Route path="/login" component={LoginPage} />
            <Route path="/accept-invite" component={AcceptInvitePage} />
            <Route>
              <ProtectedRoute>
                <Layout>
                  <Switch>
                    <Route path="/" component={DashboardPage} />
                    <Route path="/request" component={RequestLeavePage} />
                    <Route path="/my-requests" component={MyRequestsPage} />
                    <Route path="/approvals" component={ApprovalsPage} />
                    <Route path="/team" component={TeamOverviewPage} />
                    <Route path="/calendar" component={TeamCalendarPage} />
                    <Route path="/people" component={PeoplePage} />
                    <Route path="/audit" component={AuditLogPage} />
                    <Route path="/settings" component={SettingsPage} />
                  </Switch>
                </Layout>
              </ProtectedRoute>
            </Route>
          </Switch>
        </Router>
        <Toaster />
      </AuthProvider>
    </QueryClientProvider>
  );
}
