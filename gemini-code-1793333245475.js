import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  updateDoc, 
  doc, 
  setDoc, 
  getDoc,
  orderBy 
} from 'firebase/firestore';
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  Users, 
  DollarSign, 
  LogOut, 
  Plus, 
  Building, 
  ShieldCheck, 
  AlertCircle,
  Calendar,
  UserCheck
} from 'lucide-react';

// Initialize Firebase with environment variables
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export default function App() {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Auth state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // App state
  const [activeTab, setActiveTab] = useState('timesheet');
  const [timesheets, setTimesheets] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  // Form states
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('16:00');
  const [breakMins, setBreakMins] = useState('30');
  const [room, setRoom] = useState('Infant Room');
  const [notes, setNotes] = useState('');

  // New staff creation state
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffEmail, setNewStaffEmail] = useState('');
  const [newStaffPassword, setNewStaffPassword] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('employee');
  const [newStaffRoom, setNewStaffRoom] = useState('Infant Room');
  const [newStaffRate, setNewStaffRate] = useState('18.00');
  const [staffCreateSuccess, setStaffCreateSuccess] = useState('');

  // Watch Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Fetch User Profile from Firestore
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
          setUserData(userDoc.data());
        } else {
          // Default fallback
          setUserData({ name: currentUser.email.split('@')[0], role: 'employee', room: 'General' });
        }
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch Timesheets Realtime
  useEffect(() => {
    if (!user || !userData) return;

    let q;
    if (userData.role === 'director') {
      // Director sees all timesheets
      q = query(collection(db, 'timesheets'), orderBy('date', 'desc'));
    } else {
      // Employee only sees their own timesheets
      q = query(
        collection(db, 'timesheets'), 
        where('userId', '==', user.uid),
        orderBy('date', 'desc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs = [];
      snapshot.forEach((doc) => {
        logs.push({ id: doc.id, ...doc.data() });
      });
      setTimesheets(logs);
    });

    return () => unsubscribe();
  }, [user, userData]);

  // Fetch All Staff (For Director View)
  useEffect(() => {
    if (userData?.role === 'director') {
      const q = query(collection(db, 'users'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const usersList = [];
        snapshot.forEach((doc) => {
          usersList.push({ id: doc.id, ...doc.data() });
        });
        setAllUsers(usersList);
      });
      return () => unsubscribe();
    }
  }, [userData]);

  // Handle Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setAuthError('Invalid credentials. Please try again.');
    }
  };

  // Calculate Total Hours
  const calculateHours = (start, end, breakMinutes) => {
    if (!start || !end) return 0;
    const [sHours, sMins] = start.split(':').map(Number);
    const [eHours, eMins] = end.split(':').map(Number);
    let totalMins = (eHours * 60 + eMins) - (sHours * 60 + sMins) - Number(breakMinutes || 0);
    return Math.max(0, (totalMins / 60)).toFixed(2);
  };

  // Submit Hours Log
  const handleLogHours = async (e) => {
    e.preventDefault();
    const hours = calculateHours(startTime, endTime, breakMins);
    
    try {
      await addDoc(collection(db, 'timesheets'), {
        userId: user.uid,
        userName: userData.name || user.email,
        date,
        startTime,
        endTime,
        breakMins: Number(breakMins),
        totalHours: Number(hours),
        room,
        notes,
        status: 'Pending',
        hourlyRate: userData.hourlyRate || 18.00,
        createdAt: new Date().toISOString()
      });

      setNotes('');
      alert('Hours logged successfully!');
    } catch (err) {
      console.error('Error logging hours:', err);
      alert('Failed to log hours. Please try again.');
    }
  };

  // Update Timesheet Status (Approve/Reject)
  const handleStatusUpdate = async (timesheetId, status) => {
    try {
      await updateDoc(doc(db, 'timesheets', timesheetId), {
        status,
        reviewedAt: new Date().toISOString(),
        reviewedBy: userData.name
      });
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  // Create New Staff Account
  const handleCreateStaff = async (e) => {
    e.preventDefault();
    setStaffCreateSuccess('');
    try {
      // Create auth user
      const userCred = await createUserWithEmailAndPassword(auth, newStaffEmail, newStaffPassword);
      // Save user doc in Firestore
      await setDoc(doc(db, 'users', userCred.user.uid), {
        name: newStaffName,
        email: newStaffEmail,
        role: newStaffRole,
        room: newStaffRoom,
        hourlyRate: Number(newStaffRate),
        createdAt: new Date().toISOString()
      });

      setStaffCreateSuccess(`Staff account for ${newStaffName} created successfully!`);
      setNewStaffName('');
      setNewStaffEmail('');
      setNewStaffPassword('');
    } catch (err) {
      alert('Error creating staff account: ' + err.message);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-teal-50 flex items-center justify-center">
        <div className="text-teal-700 font-semibold text-lg flex items-center gap-2">
          <Clock className="animate-spin" /> Loading DayStart Day Care...
        </div>
      </div>
    );
  }

  // LOGIN SCREEN
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-600 to-teal-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-8 border border-teal-100">
          <div className="text-center mb-8">
            <div className="bg-teal-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
              <Building className="w-8 h-8 text-teal-700" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">DayStart Day Care</h1>
            <p className="text-sm text-gray-500 mt-1">Staff Timesheet Management Portal</p>
          </div>

          {authError && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {authError}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
              <input 
                type="email" 
                required 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                placeholder="staff@daystart.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input 
                type="password" 
                required 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none"
                placeholder="••••••••"
              />
            </div>
            <button 
              type="submit" 
              className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2.5 rounded-lg transition"
            >
              Sign In
            </button>
          </form>
        </div>
      </div>
    );
  }

  // MAIN DASHBOARD SCREEN
  const isDirector = userData?.role === 'director';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Header */}
      <header className="bg-teal-700 text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Building className="w-7 h-7 text-teal-200" />
            <div>
              <h1 className="text-xl font-bold leading-tight">DayStart Day Care</h1>
              <span className="text-xs text-teal-200 flex items-center gap-1">
                <ShieldCheck className="w-3.5 h-3.5" /> 
                Logged in as {userData?.name} ({isDirector ? 'Director' : 'Staff Member'})
              </span>
            </div>
          </div>
          <button 
            onClick={() => signOut(auth)}
            className="flex items-center gap-2 bg-teal-800 hover:bg-teal-900 px-3 py-1.5 rounded-lg text-sm text-teal-100 transition"
          >
            <LogOut className="w-4 h-4" /> Sign Out
          </button>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-6xl mx-auto px-4 flex gap-4">
          <button 
            onClick={() => setActiveTab('timesheet')}
            className={`py-3 px-4 font-medium text-sm border-b-2 transition flex items-center gap-2 ${
              activeTab === 'timesheet' 
                ? 'border-teal-600 text-teal-700' 
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Clock className="w-4 h-4" /> {isDirector ? 'All Staff Timesheets' : 'My Hours'}
          </button>

          {isDirector && (
            <>
              <button 
                onClick={() => setActiveTab('approvals')}
                className={`py-3 px-4 font-medium text-sm border-b-2 transition flex items-center gap-2 ${
                  activeTab === 'approvals' 
                    ? 'border-teal-600 text-teal-700' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <CheckCircle className="w-4 h-4" /> Pending Approvals
              </button>
              <button 
                onClick={() => setActiveTab('staff')}
                className={`py-3 px-4 font-medium text-sm border-b-2 transition flex items-center gap-2 ${
                  activeTab === 'staff' 
                    ? 'border-teal-600 text-teal-700' 
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Users className="w-4 h-4" /> Manage Staff
              </button>
            </>
          )}
        </div>
      </div>

      {/* Body Content */}
      <main className="max-w-6xl mx-auto px-4 py-6 flex-1 w-full">
        
        {/* TAB 1: TIMESHEET VIEW */}
        {activeTab === 'timesheet' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Log Hours Form (Employees & Directors) */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-teal-600" /> Log Work Hours
              </h2>
              
              <form onSubmit={handleLogHours} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Date</label>
                  <input 
                    type="date" 
                    required 
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Start Time</label>
                    <input 
                      type="time" 
                      required 
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">End Time</label>
                    <input 
                      type="time" 
                      required 
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Break (Mins)</label>
                    <input 
                      type="number" 
                      value={breakMins}
                      onChange={(e) => setBreakMins(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Room Assignment</label>
                    <select 
                      value={room} 
                      onChange={(e) => setRoom(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white"
                    >
                      <option value="Infant Room">Infant Room</option>
                      <option value="Toddler Room">Toddler Room</option>
                      <option value="Preschool Room">Preschool Room</option>
                      <option value="Front Desk">Front Desk</option>
                      <option value="Kitchen / Facility">Kitchen / Facility</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Daily Notes / Activities</label>
                  <textarea 
                    rows="2"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Optional details (e.g. outdoor play coverage)..."
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  ></textarea>
                </div>

                <div className="p-3 bg-teal-50 rounded-lg text-xs text-teal-800 font-medium flex justify-between items-center">
                  <span>Calculated Hours:</span>
                  <span className="text-base font-bold">{calculateHours(startTime, endTime, breakMins)} hrs</span>
                </div>

                <button 
                  type="submit" 
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 rounded-lg text-sm transition"
                >
                  Submit Hours for Approval
                </button>
              </form>
            </div>

            {/* Timesheet Log Table */}
            <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center justify-between">
                <span>{isDirector ? 'All Submitted Staff Hours' : 'My Logged Hours'}</span>
                <span className="text-xs bg-teal-100 text-teal-800 px-2.5 py-1 rounded-full font-medium">
                  {timesheets.length} Entries
                </span>
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b text-gray-600 text-xs uppercase">
                    <tr>
                      <th className="p-3">Date</th>
                      {isDirector && <th className="p-3">Staff</th>}
                      <th className="p-3">Room</th>
                      <th className="p-3">Hours</th>
                      <th className="p-3">Status</th>
                      {isDirector && <th className="p-3">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y text-gray-700">
                    {timesheets.length === 0 ? (
                      <tr>
                        <td colSpan={isDirector ? 6 : 4} className="p-6 text-center text-gray-400">
                          No logged hours found.
                        </td>
                      </tr>
                    ) : (
                      timesheets.map((ts) => (
                        <tr key={ts.id} className="hover:bg-slate-50">
                          <td className="p-3 font-medium text-gray-900">{ts.date}</td>
                          {isDirector && <td className="p-3 font-semibold">{ts.userName}</td>}
                          <td className="p-3 text-gray-600">{ts.room}</td>
                          <td className="p-3 font-bold">{ts.totalHours} hrs</td>
                          <td className="p-3">
                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold flex items-center gap-1 w-fit ${
                              ts.status === 'Approved' ? 'bg-green-100 text-green-700' :
                              ts.status === 'Rejected' ? 'bg-red-100 text-red-700' :
                              'bg-amber-100 text-amber-700'
                            }`}>
                              {ts.status === 'Approved' && <CheckCircle className="w-3 h-3" />}
                              {ts.status === 'Rejected' && <XCircle className="w-3 h-3" />}
                              {ts.status === 'Pending' && <Clock className="w-3 h-3" />}
                              {ts.status}
                            </span>
                          </td>
                          {isDirector && (
                            <td className="p-3">
                              {ts.status === 'Pending' && (
                                <div className="flex gap-1">
                                  <button 
                                    onClick={() => handleStatusUpdate(ts.id, 'Approved')}
                                    className="p-1 bg-green-50 hover:bg-green-100 text-green-700 rounded transition"
                                    title="Approve"
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                  </button>
                                  <button 
                                    onClick={() => handleStatusUpdate(ts.id, 'Rejected')}
                                    className="p-1 bg-red-50 hover:bg-red-100 text-red-700 rounded transition"
                                    title="Reject"
                                  >
                                    <XCircle className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PENDING APPROVALS (DIRECTOR ONLY) */}
        {activeTab === 'approvals' && isDirector && (
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-teal-600" /> Pending Timesheet Approvals
            </h2>

            <div className="space-y-4">
              {timesheets.filter(t => t.status === 'Pending').length === 0 ? (
                <p className="text-center py-8 text-gray-400">All staff hours are up to date! No pending approvals.</p>
              ) : (
                timesheets.filter(t => t.status === 'Pending').map((ts) => (
                  <div key={ts.id} className="p-4 border rounded-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-teal-200">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">{ts.userName}</span>
                        <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">{ts.room}</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">
                        Date: <span className="font-medium text-gray-700">{ts.date}</span> | Time: {ts.startTime} - {ts.endTime} ({ts.breakMins}m break)
                      </p>
                      {ts.notes && <p className="text-xs italic text-gray-600 mt-1">"{ts.notes}"</p>}
                    </div>

                    <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t md:border-0 pt-3 md:pt-0">
                      <div className="text-right">
                        <span className="block text-lg font-extrabold text-teal-700">{ts.totalHours} hrs</span>
                        <span className="text-xs text-gray-400">${((ts.hourlyRate || 18) * ts.totalHours).toFixed(2)} est. pay</span>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleStatusUpdate(ts.id, 'Approved')}
                          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white font-medium text-xs rounded-lg transition flex items-center gap-1"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Approve
                        </button>
                        <button 
                          onClick={() => handleStatusUpdate(ts.id, 'Rejected')}
                          className="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white font-medium text-xs rounded-lg transition flex items-center gap-1"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Reject
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: MANAGE STAFF (DIRECTOR ONLY) */}
        {activeTab === 'staff' && isDirector && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Add Staff Form */}
            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-teal-600" /> Onboard New Staff
              </h2>

              {staffCreateSuccess && (
                <div className="mb-4 p-3 bg-green-50 text-green-700 text-xs rounded-lg font-medium">
                  {staffCreateSuccess}
                </div>
              )}

              <form onSubmit={handleCreateStaff} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Full Name</label>
                  <input 
                    type="text" 
                    required 
                    value={newStaffName}
                    onChange={(e) => setNewStaffName(e.target.value)}
                    placeholder="Sarah Jenkins"
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Email</label>
                  <input 
                    type="email" 
                    required 
                    value={newStaffEmail}
                    onChange={(e) => setNewStaffEmail(e.target.value)}
                    placeholder="sarah@daystart.com"
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Initial Password</label>
                  <input 
                    type="password" 
                    required 
                    value={newStaffPassword}
                    onChange={(e) => setNewStaffPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Role</label>
                    <select 
                      value={newStaffRole}
                      onChange={(e) => setNewStaffRole(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white"
                    >
                      <option value="employee">Employee</option>
                      <option value="director">Director</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Assigned Room</label>
                    <select 
                      value={newStaffRoom}
                      onChange={(e) => setNewStaffRoom(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none bg-white"
                    >
                      <option value="Infant Room">Infant Room</option>
                      <option value="Toddler Room">Toddler Room</option>
                      <option value="Preschool Room">Preschool Room</option>
                      <option value="Front Desk">Front Desk</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-600 uppercase mb-1">Hourly Rate ($)</label>
                  <input 
                    type="number" 
                    step="0.50"
                    required 
                    value={newStaffRate}
                    onChange={(e) => setNewStaffRate(e.target.value)}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 focus:outline-none"
                  />
                </div>

                <button 
                  type="submit" 
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-2 rounded-lg text-sm transition"
                >
                  Create Staff Account
                </button>
              </form>
            </div>

            {/* Staff Roster */}
            <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
              <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center justify-between">
                <span>DayCare Staff Roster</span>
                <span className="text-xs bg-teal-100 text-teal-800 px-2.5 py-1 rounded-full font-medium">
                  {allUsers.length} Active Staff
                </span>
              </h2>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b text-gray-600 text-xs uppercase">
                    <tr>
                      <th className="p-3">Name</th>
                      <th className="p-3">Email</th>
                      <th className="p-3">Role</th>
                      <th className="p-3">Room</th>
                      <th className="p-3">Hourly Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-gray-700">
                    {allUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50">
                        <td className="p-3 font-semibold text-gray-900">{u.name}</td>
                        <td className="p-3 text-gray-500">{u.email}</td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${
                            u.role === 'director' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="p-3">{u.room || 'N/A'}</td>
                        <td className="p-3 font-bold">${u.hourlyRate ? u.hourlyRate.toFixed(2) : '18.00'}/hr</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

      </main>
    </div>
  );
}