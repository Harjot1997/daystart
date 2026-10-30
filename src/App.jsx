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
  LogOut, 
  ShieldCheck, 
  UserCheck,
  Calendar
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
  const [userRole, setUserRole] = useState('employee');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(true);

  // Timesheet State
  const [clockedIn, setClockedIn] = useState(false);
  const [activeShiftId, setActiveShiftId] = useState(null);
  const [userShifts, setUserShifts] = useState([]);
  const [allShifts, setAllShifts] = useState([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Fetch User Role from Firestore
        const userDocRef = doc(db, 'users', currentUser.uid);
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
          setUserRole(userDoc.data().role || 'employee');
        } else {
          // Default new user to 'employee'
          await setDoc(userDocRef, {
            email: currentUser.email,
            role: 'employee'
          });
          setUserRole('employee');
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Fetch employee-specific shifts
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'timesheets'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const shifts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUserShifts(shifts);

      // Check if user currently has an active shift
      const active = shifts.find(s => !s.clockOut);
      if (active) {
        setClockedIn(true);
        setActiveShiftId(active.id);
      } else {
        setClockedIn(false);
        setActiveShiftId(null);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Fetch all shifts if user is Director
  useEffect(() => {
    if (!user || userRole !== 'director') return;

    const q = query(collection(db, 'timesheets'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const shifts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAllShifts(shifts);
    });

    return () => unsubscribe();
  }, [user, userRole]);

  const handleAuth = async (e) => {
    e.preventDefault();
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleClockIn = async () => {
    try {
      const docRef = await addDoc(collection(db, 'timesheets'), {
        userId: user.uid,
        userEmail: user.email,
        clockIn: new Date().toISOString(),
        clockOut: null,
        status: 'pending'
      });
      setClockedIn(true);
      setActiveShiftId(docRef.id);
    } catch (err) {
      alert("Error clocking in: " + err.message);
    }
  };

  const handleClockOut = async () => {
    if (!activeShiftId) return;
    try {
      await updateDoc(doc(db, 'timesheets', activeShiftId), {
        clockOut: new Date().toISOString()
      });
      setClockedIn(false);
      setActiveShiftId(null);
    } catch (err) {
      alert("Error clocking out: " + err.message);
    }
  };

  const handleApproveShift = async (shiftId, newStatus) => {
    try {
      await updateDoc(doc(db, 'timesheets', shiftId), {
        status: newStatus
      });
    } catch (err) {
      alert("Error updating shift: " + err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100">
        <p className="text-lg font-semibold text-slate-600">Loading DayStart Day Care...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100 p-4">
        <div className="bg-white p-8 rounded-xl shadow-md w-full max-w-md">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-slate-800">DayStart Day Care</h1>
            <p className="text-slate-500 text-sm mt-1">Employee Timesheet Portal</p>
          </div>
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)}
                required 
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="name@daystart.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <input 
                type="password" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)}
                required 
                className="w-full p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                placeholder="••••••••"
              />
            </div>
            <button 
              type="submit" 
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2.5 rounded-lg transition"
            >
              {isSignUp ? 'Create Account' : 'Sign In'}
            </button>
          </form>
          <button 
            onClick={() => setIsSignUp(!isSignUp)}
            className="w-full text-sm text-indigo-600 hover:underline text-center mt-4 block"
          >
            {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 p-4">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold text-slate-800">DayStart Day Care</h1>
            <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
              {userRole === 'director' ? (
                <span className="text-emerald-600 font-semibold flex items-center gap-1">
                  <ShieldCheck size={14} /> Director Dashboard
                </span>
              ) : (
                <span className="text-indigo-600 font-semibold flex items-center gap-1">
                  <UserCheck size={14} /> Employee Dashboard
                </span>
              )}
            </p>
          </div>
          <button 
            onClick={() => signOut(auth)}
            className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg text-sm transition"
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto p-4 mt-4 space-y-6">
        {/* User Card */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 flex justify-between items-center">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Logged In As</p>
            <p className="text-base font-bold text-slate-800">{user.email}</p>
          </div>
          <span className={`px-3 py-1 text-xs font-semibold rounded-full uppercase ${
            userRole === 'director' ? 'bg-emerald-100 text-emerald-800' : 'bg-indigo-100 text-indigo-800'
          }`}>
            {userRole}
          </span>
        </div>

        {/* EMPLOYEE VIEW */}
        {userRole === 'employee' && (
          <div className="space-y-6">
            {/* Clock In/Out Section */}
            <div className="bg-white p-6 rounded-xl border border-slate-200 text-center space-y-4">
              <h2 className="text-lg font-bold text-slate-800 flex items-center justify-center gap-2">
                <Clock className="text-indigo-600" size={20} /> Shift Tracker
              </h2>
              <div>
                {clockedIn ? (
                  <button 
                    onClick={handleClockOut}
                    className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-8 py-4 rounded-xl text-lg transition shadow-md"
                  >
                    Clock Out Now
                  </button>
                ) : (
                  <button 
                    onClick={handleClockIn}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 py-4 rounded-xl text-lg transition shadow-md"
                  >
                    Clock In Now
                  </button>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {clockedIn ? 'You are currently clocked in.' : 'Click to start tracking your working hours.'}
              </p>
            </div>

            {/* My Shift History */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="p-4 bg-slate-50 border-b border-slate-200">
                <h3 className="font-bold text-slate-700 flex items-center gap-2">
                  <Calendar size={18} /> My Recent Shifts
                </h3>
              </div>
              <div className="divide-y divide-slate-100">
                {userShifts.length === 0 ? (
                  <p className="p-4 text-sm text-slate-500 text-center">No shifts recorded yet.</p>
                ) : (
                  userShifts.map((shift) => (
                    <div key={shift.id} className="p-4 flex justify-between items-center text-sm">
                      <div>
                        <p className="font-medium text-slate-800">
                          In: {new Date(shift.clockIn).toLocaleString()}
                        </p>
                        <p className="text-slate-500 text-xs mt-0.5">
                          Out: {shift.clockOut ? new Date(shift.clockOut).toLocaleString() : 'Active Shift'}
                        </p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        shift.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                        shift.status === 'rejected' ? 'bg-rose-100 text-rose-700' :
                        'bg-amber-100 text-amber-700'
                      }`}>
                        {shift.status || 'pending'}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* DIRECTOR VIEW */}
        {userRole === 'director' && (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-bold text-slate-700 flex items-center gap-2">
                <Users size={18} /> Staff Timesheet Approvals
              </h3>
              <span className="text-xs font-semibold text-slate-500">{allShifts.length} Total Shifts</span>
            </div>
            <div className="divide-y divide-slate-100">
              {allShifts.length === 0 ? (
                <p className="p-4 text-sm text-slate-500 text-center">No staff timesheets found.</p>
              ) : (
                allShifts.map((shift) => (
                  <div key={shift.id} className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-sm">
                    <div>
                      <p className="font-bold text-slate-800">{shift.userEmail}</p>
                      <p className="text-slate-600 text-xs mt-1">
                        In: {new Date(shift.clockIn).toLocaleString()}
                      </p>
                      <p className="text-slate-600 text-xs">
                        Out: {shift.clockOut ? new Date(shift.clockOut).toLocaleString() : 'Currently Working'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => handleApproveShift(shift.id, 'approved')}
                        className="flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 px-3 py-1.5 rounded-lg text-xs font-medium transition"
                      >
                        <CheckCircle size={14} /> Approve
                      </button>
                      <button 
                        onClick={() => handleApproveShift(shift.id, 'rejected')}
                        className="flex items-center gap-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 px-3 py-1.5 rounded-lg text-xs font-medium transition"
                      >
                        <XCircle size={14} /> Reject
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
