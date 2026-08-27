import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute.jsx";

import Login from "./pages/Login.jsx";
import Register from "./pages/Register.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import ForgotPassword from "./pages/ForgotPassword.jsx";
import ForgotUserName from "./pages/ForgotUserName.jsx";
import ChangePassword from "./pages/ChangePassword.jsx";
import UpdateProfile from "./pages/UpdateProfile.jsx";
import TokenInformation from "./pages/TokenInformation.jsx";
import DocumentEntry from "./pages/DocumentEntry.jsx";
import RentTerms from "./pages/RentTerms.jsx";
import StampDutyCalculate from "./pages/StampDutyCalculate.jsx";
import PropertyDetails from "./pages/PropertyDetails.jsx";
import PartyDetails from "./pages/PartyDetails.jsx";
import IdentificationDetails from "./pages/IdentificationDetails.jsx";
import DataEntryReport from "./pages/DataEntryReport.jsx";
import Confirmation from "./pages/Confirmation.jsx";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/forgot-username" element={<ForgotUserName />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/change-password"
        element={
          <ProtectedRoute>
            <ChangePassword />
          </ProtectedRoute>
        }
      />
      <Route
        path="/update-profile"
        element={
          <ProtectedRoute>
            <UpdateProfile />
          </ProtectedRoute>
        }
      />
      <Route
        path="/tokens"
        element={
          <ProtectedRoute>
            <TokenInformation />
          </ProtectedRoute>
        }
      />
      <Route
        path="/entries/new"
        element={
          <ProtectedRoute>
            <DocumentEntry />
          </ProtectedRoute>
        }
      />
      <Route
        path="/entries/:id/rent-terms"
        element={
          <ProtectedRoute>
            <RentTerms />
          </ProtectedRoute>
        }
      />
      <Route
        path="/stamp-duty-calculate"
        element={
          <ProtectedRoute>
            <StampDutyCalculate />
          </ProtectedRoute>
        }
      />
      <Route
        path="/entries/:id/properties"
        element={
          <ProtectedRoute>
            <PropertyDetails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/entries/:id/parties"
        element={
          <ProtectedRoute>
            <PartyDetails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/entries/:id/identifications"
        element={
          <ProtectedRoute>
            <IdentificationDetails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/entries/:id/report"
        element={
          <ProtectedRoute>
            <DataEntryReport />
          </ProtectedRoute>
        }
      />
      <Route
        path="/entries/:id/confirmation"
        element={
          <ProtectedRoute>
            <Confirmation />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}
