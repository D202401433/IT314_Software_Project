"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ResQProvider, useResQ } from "../../context/ResQContext";
import { PortalRoleCategory, UserRole } from "../../types/resq";

function SignupPageContent() {
  const router = useRouter();
  const { signup } = useResQ();

  const [selectedCategory, setSelectedCategory] = useState<PortalRoleCategory>("user");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("+91 ");
  const [specificRole, setSpecificRole] = useState<UserRole>("Public / Citizen");
  const [agency, setAgency] = useState("Public Resident / Citizen");
  const [badgeNumber, setBadgeNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleCategoryChange = (cat: PortalRoleCategory) => {
    setSelectedCategory(cat);
    setErrorMsg(null);
    if (cat === "user") {
      setSpecificRole("Public / Citizen");
      setAgency("Public Resident / Citizen");
    } else if (cat === "admin") {
      setSpecificRole("Command Officer / Incident Commander");
      setAgency("National Disaster Management Authority (NDMA)");
    } else {
      setSpecificRole("Medic / Ambulance Team");
      setAgency("Emergency Medical Services (EMS 108)");
    }
  };

  const handleSignupSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fullName.trim()) {
      setErrorMsg("Please enter your full name.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setErrorMsg("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      return;
    }

    let finalRole: UserRole = specificRole;
    if (selectedCategory === "user") {
      finalRole = "Public / Citizen";
    }

    const newUser = signup({
      name: fullName.trim(),
      email: email.trim(),
      phone: phone.trim(),
      role: finalRole,
      agency: agency.trim() || (selectedCategory === "user" ? "Public Citizen" : "Emergency Operations Division"),
      badgeNumber: badgeNumber.trim() || undefined,
      password: password,
    });

    setSuccessMsg(`Account created for ${newUser.name}! Entering your customized dashboard...`);
    setTimeout(() => {
      router.push("/");
    }, 450);
  };

  return (
    <div className="min-h-screen w-screen bg-[#070d18] text-white flex flex-col justify-between overflow-x-hidden font-sans">
      <header className="h-14 bg-[#0c4a75] border-b border-[#093554] px-6 flex items-center justify-between shadow-md">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-sky-400/20 border border-white flex items-center justify-center text-lg">
            🛡️
          </div>
          <div>
            <div className="flex items-baseline gap-1.5 leading-tight">
              <span className="text-xl font-extrabold text-white">ResQ</span>
              <span className="text-xs font-light text-sky-200">GeoPlatform</span>
            </div>
            <div className="text-[9px] text-sky-200/80">NDMA Disaster Response Coordination Hub</div>
          </div>
        </Link>

        <Link
          href="/"
          className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-full transition flex items-center gap-1.5"
        >
          <span>←</span> Return to General Dashboard
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 py-8">
        <div className="bg-[#0b1324] border border-slate-700/80 rounded-2xl shadow-2xl max-w-lg w-full p-6 md:p-8 space-y-6">
          <div className="text-center space-y-1">
            <h1 className="text-2xl font-extrabold text-white tracking-tight">
              Create an Account
            </h1>
            <p className="text-xs text-slate-400">
              Register as a Citizen, Administrator, or Service Provider to access customized emergency tools.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-300 mb-2">
              Who is registering? <span className="text-sky-400">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => handleCategoryChange("user")}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  selectedCategory === "user"
                    ? "bg-sky-950/70 border-sky-500 shadow-md ring-1 ring-sky-500"
                    : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <span className="text-xl mb-1">👤</span>
                <div>
                  <div className={`text-xs font-bold ${selectedCategory === "user" ? "text-white" : "text-slate-300"}`}>
                    Citizen / User
                  </div>
                  <div className="text-[9.5px] text-slate-400">Emergency SOS intake</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleCategoryChange("admin")}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  selectedCategory === "admin"
                    ? "bg-blue-950/70 border-blue-500 shadow-md ring-1 ring-blue-500"
                    : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <span className="text-xl mb-1">🛡️</span>
                <div>
                  <div className={`text-xs font-bold ${selectedCategory === "admin" ? "text-white" : "text-slate-300"}`}>
                    Administrator
                  </div>
                  <div className="text-[9.5px] text-slate-400">Command & Dispatch</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleCategoryChange("service_provider")}
                className={`p-3 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  selectedCategory === "service_provider"
                    ? "bg-amber-950/70 border-amber-500 shadow-md ring-1 ring-amber-500"
                    : "bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700"
                }`}
              >
                <span className="text-xl mb-1">🚑</span>
                <div>
                  <div className={`text-xs font-bold ${selectedCategory === "service_provider" ? "text-white" : "text-slate-300"}`}>
                    Service Provider
                  </div>
                  <div className="text-[9.5px] text-slate-400">Medic, Fire & NDRF</div>
                </div>
              </button>
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-950/80 border border-red-700/60 rounded-xl text-red-200 text-xs flex items-center gap-2">
              <span>⚠️</span>
              <span>{errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="p-3 bg-emerald-950/80 border border-emerald-700/60 rounded-xl text-emerald-200 text-xs flex items-center gap-2">
              <span>✅</span>
              <span>{successMsg}</span>
            </div>
          )}

          <form onSubmit={handleSignupSubmit} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Ramesh Chandra"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Phone Number</label>
                <input
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ramesh@resq.gov.in"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            {selectedCategory !== "user" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Operational Role</label>
                  <select
                    value={specificRole}
                    onChange={(e) => setSpecificRole(e.target.value as UserRole)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-sky-500"
                  >
                    {selectedCategory === "admin" ? (
                      <>
                        <option value="Command Officer / Incident Commander">Incident Commander (NDMA)</option>
                        <option value="Dispatcher">Emergency Dispatcher (ERSS 112)</option>
                        <option value="System Administrator">System Administrator (DRCH)</option>
                      </>
                    ) : (
                      <>
                        <option value="Medic / Ambulance Team">Ambulance Paramedic (EMS 108)</option>
                        <option value="Firefighter / Fire Service Officer">Fire & Rescue Officer</option>
                        <option value="NDRF / SDRF Team Leader or Responder">NDRF Rescue Team Leader</option>
                        <option value="Logistics Officer">Disaster Logistics & Relief Officer</option>
                      </>
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Badge / Callsign</label>
                  <input
                    type="text"
                    value={badgeNumber}
                    onChange={(e) => setBadgeNumber(e.target.value)}
                    placeholder={selectedCategory === "admin" ? "NDMA-HQ-09" : "AMB-22 / FIRE-15"}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Agency / Organization</label>
              <input
                type="text"
                value={agency}
                onChange={(e) => setAgency(e.target.value)}
                placeholder={selectedCategory === "user" ? "Public Resident" : "e.g. State Disaster Response Force"}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Confirm Password</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 px-4 rounded-xl text-sm transition shadow-lg shadow-emerald-600/30 cursor-pointer flex items-center justify-center gap-2"
              >
                <span>Complete Registration & Enter Portal</span>
                <span>→</span>
              </button>
            </div>
          </form>

          <div className="pt-3 border-t border-slate-800 text-center text-xs text-slate-400 space-y-2">
            <div>
              Already have an account?{" "}
              <Link href="/login" className="text-sky-400 hover:text-sky-300 font-bold underline">
                Sign In here
              </Link>
            </div>
            <div>
              <Link href="/" className="text-slate-400 hover:text-slate-200">
                Or browse general public dashboard →
              </Link>
            </div>
          </div>
        </div>
      </main>

      <footer className="py-3 text-center text-[11px] text-slate-500 border-t border-slate-800/60 bg-slate-950">
        ResQ Disaster Response Coordination Hub • National Emergency Portal (112)
      </footer>
    </div>
  );
}

export default function SignupPage() {
  return (
    <ResQProvider>
      <SignupPageContent />
    </ResQProvider>
  );
}
