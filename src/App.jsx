import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const configured = Boolean(
  SUPABASE_URL &&
  SUPABASE_KEY &&
  !SUPABASE_URL.includes('YOUR_PROJECT') &&
  !SUPABASE_KEY.includes('YOUR_SUPABASE')
);
const supabase = configured ? createClient(SUPABASE_URL, SUPABASE_KEY) : null;

const MATCH_ID = 'psg-barcelona-ucl';
const MATCH = {
  title: 'UEFA CHAMPIONS LEAGUE · LEAGUE PHASE',
  round: 'MATCHDAY 3',
  kickoff: '9 PM CET',
  stadiumImage: 'https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=1400&q=85'
};

const DEPARTMENTS = ['CSE', 'ECE', 'EEE', 'ME', 'CE', 'Other'];
const YEARS = ['1st Year', '2nd Year', '3rd Year', '4th Year'];

function Crest({ team }) {
  return team === 'psg'
    ? <img className="crest" src="https://upload.wikimedia.org/wikipedia/en/a/a7/Paris_Saint-Germain_F.C..svg" alt="Paris Saint-Germain crest" />
    : <img className="crest" src="https://upload.wikimedia.org/wikipedia/en/4/47/FC_Barcelona_%28crest%29.svg" alt="FC Barcelona crest" />;
}

export default function App() {
  const [session, setSession] = useState(null);
  const [studentProfile, setStudentProfile] = useState(null);
  const [initializing, setInitializing] = useState(true);

  // Form states for Student Identity
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('CSE');
  const [year, setYear] = useState('1st Year');
  const [classDivision, setClassDivision] = useState('');

  // Match & Prediction states
  const [home, setHome] = useState(1);
  const [away, setAway] = useState(2);
  const [prediction, setPrediction] = useState(null);

  // UI state
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = useState(false);

  // Load existing student profile & prediction
  async function loadStudentData(userId) {
    if (!supabase || !userId) return;
    try {
      // 1. Fetch student profile
      const { data: profile, error: profErr } = await supabase
        .from('student_profiles')
        .select('id, full_name, department, year, class_division')
        .eq('id', userId)
        .maybeSingle();

      if (profErr) {
        console.warn('[Profile] Fetch warning:', profErr.message);
      }

      if (profile) {
        setStudentProfile(profile);
        setFullName(profile.full_name);
        setDepartment(profile.department);
        setYear(profile.year);
        setClassDivision(profile.class_division);
      } else {
        setStudentProfile(null);
      }

      // 2. Fetch existing prediction
      const { data: saved, error: predErr } = await supabase
        .from('predictions')
        .select('prediction_home, prediction_away, psg_score, barca_score, created_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (predErr) {
        console.warn('[Prediction] Fetch warning:', predErr.message);
      }

      if (saved) {
        const homeScore = saved.prediction_home ?? saved.psg_score ?? 1;
        const awayScore = saved.prediction_away ?? saved.barca_score ?? 2;
        setPrediction({
          prediction_home: homeScore,
          prediction_away: awayScore,
          created_at: saved.created_at
        });
        setHome(homeScore);
        setAway(awayScore);
      }
    } catch (err) {
      console.error('[Data] Load error:', err);
    }
  }

  // Restore or initialize anonymous session
  useEffect(() => {
    if (!supabase) {
      setInitializing(false);
      return;
    }
    let mounted = true;

    async function initSession() {
      try {
        let { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!currentSession) {
          const { data, error } = await supabase.auth.signInAnonymously();
          if (error) {
            console.error('[Auth] Anonymous sign-in error:', error.message);
            setNotice('Could not start student session: ' + error.message + '. Ensure Anonymous sign-ins are enabled in Supabase.');
          } else {
            currentSession = data.session;
          }
        }
        if (mounted && currentSession) {
          setSession(currentSession);
          await loadStudentData(currentSession.user.id);
        }
      } catch (err) {
        console.error('[Auth] Init exception:', err);
      } finally {
        if (mounted) setInitializing(false);
      }
    }

    initSession();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, next) => {
      if (!mounted) return;
      setSession(next);
      if (next?.user) {
        await loadStudentData(next.user.id);
      } else {
        setStudentProfile(null);
        setPrediction(null);
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // Save student identity profile (New or Updated)
  async function saveStudentProfile(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!supabase) {
      setNotice('Database is not configured yet.');
      return;
    }

    let activeUser = session?.user;
    if (!activeUser) {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error) {
        setNotice('Session error: ' + error.message);
        return;
      }
      setSession(data.session);
      activeUser = data.session.user;
    }

    setBusy(true);
    setNotice('');

    try {
      const profileData = {
        id: activeUser.id,
        full_name: fullName.trim(),
        department,
        year,
        class_division: classDivision.trim(),
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('student_profiles')
        .upsert(profileData, { onConflict: 'id' });

      if (error) throw error;

      setStudentProfile(profileData);
      setEditModalOpen(false);
      setNotice(`Welcome, ${profileData.full_name}! Select your score prediction below.`);
    } catch (err) {
      console.error('[Profile] Save failed:', err);
      setNotice(err.message || 'Could not save student details.');
    } finally {
      setBusy(false);
    }
  }

  // Submit or update score prediction
  async function submitPrediction(e) {
    if (e && e.preventDefault) e.preventDefault();
    setNotice('');

    if (!configured || !supabase) {
      setNotice('Database is not configured yet. Check your Supabase settings.');
      return;
    }

    if (!session?.user || !studentProfile) {
      setNotice('Please enter your student details first.');
      return;
    }

    setBusy(true);
    try {
      const payload = {
        user_id: session.user.id,
        match_id: MATCH_ID,
        prediction_home: home,
        prediction_away: away,
        psg_score: home,
        barca_score: away,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('predictions')
        .upsert(payload, { onConflict: 'user_id,match_id' })
        .select('prediction_home, prediction_away, created_at')
        .single();

      if (error) throw error;

      setPrediction(data || { prediction_home: home, prediction_away: away });
      setNotice('Prediction saved successfully to the shared database!');
    } catch (err) {
      console.error('[Prediction] Save failed:', err);
      setNotice(err.message || 'Prediction could not be saved.');
    } finally {
      setBusy(false);
    }
  }

  // Sign out / Reset session for a new student
  async function signOutAndReset() {
    if (!supabase) return;
    setBusy(true);
    try {
      await supabase.auth.signOut();
      setStudentProfile(null);
      setPrediction(null);
      setFullName('');
      setClassDivision('');
      setHome(1);
      setAway(2);
      setNotice('Session cleared. You can now register as a new student.');

      const { data } = await supabase.auth.signInAnonymously();
      if (data?.session) {
        setSession(data.session);
      }
    } catch (err) {
      console.error('[Auth] Reset failed:', err);
    } finally {
      setBusy(false);
    }
  }

  // Fetch leaderboard
  async function openLeaderboard() {
    setLeaderboardOpen(true);
    setLoadingLeaderboard(true);
    setLeaderboard([]);

    if (!configured || !supabase) {
      setNotice('Connect Supabase to view student rankings.');
      setLoadingLeaderboard(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('leaderboard')
        .select('display_name,full_name,department,year,class_division,prediction_home,prediction_away,points')
        .order('points', { ascending: false })
        .limit(30);

      if (error) throw error;
      setLeaderboard(data || []);
    } catch (err) {
      console.error('[Leaderboard] Fetch failed:', err);
      setNotice(`Leaderboard unavailable: ${err.message}`);
    } finally {
      setLoadingLeaderboard(false);
    }
  }

  return (
    <>
      {/* Background layer with ~20% blur, strictly non-interfering */}
      <div className="site-bg-wrapper" aria-hidden="true">
        <div className="site-bg-image" />
        <div className="site-bg-overlay" />
      </div>

      <main className="page">
        <header className="header">
          <button className="wordmark" onClick={openLeaderboard} aria-label="Open student leaderboard">
            UCL PREDICT
          </button>
          <span className="round-badge">{MATCH.round}</span>
        </header>

        {initializing ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#9fb5d0' }}>
            Loading student session…
          </div>
        ) : !studentProfile ? (
          /* Student Identity Form - Shown only when not registered on this session */
          <section className="identity-form-wrap">
            <h1 className="identity-title">Student Registration</h1>
            <p className="identity-subtitle">
              Enter your college details to make your Champions League score prediction.
            </p>

            {notice && <div className="notice" role="alert">{notice}</div>}

            <form onSubmit={saveStudentProfile}>
              <label>
                Full Name
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  required
                  maxLength={60}
                  placeholder="e.g. Rahul Sharma"
                  disabled={busy}
                />
              </label>

              <label>
                Department
                <select
                  value={department}
                  onChange={e => setDepartment(e.target.value)}
                  required
                  disabled={busy}
                >
                  {DEPARTMENTS.map(d => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </label>

              <label>
                Year
                <select
                  value={year}
                  onChange={e => setYear(e.target.value)}
                  required
                  disabled={busy}
                >
                  {YEARS.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </label>

              <label>
                Class / Division
                <input
                  type="text"
                  value={classDivision}
                  onChange={e => setClassDivision(e.target.value)}
                  required
                  maxLength={20}
                  placeholder="e.g. S4 CSA or Div B"
                  disabled={busy}
                />
              </label>

              <button className="submit" type="submit" disabled={busy}>
                {busy ? 'Saving…' : 'Continue to Match'}
              </button>
            </form>

            <div className="footer-actions" style={{ marginTop: '24px', justifyContent: 'center' }}>
              <button onClick={openLeaderboard} className="text-action">View Leaderboard</button>
            </div>
          </section>
        ) : (
          /* Existing Minimal Match Screen - Preserved Exactly */
          <>
            <section className="stadium-wrap">
              <img className="stadium" src={MATCH.stadiumImage} alt="Football stadium under floodlights" />
            </section>

            <p className="competition">{MATCH.title}</p>

            <section className="matchup" aria-label="PSG versus Barcelona">
              <div className="team">
                <Crest team="psg" />
                <h2>PSG</h2>
                <span className="side-label">HOME</span>
              </div>
              <div className="versus">
                <strong>VS</strong>
                <span>{MATCH.kickoff}</span>
              </div>
              <div className="team">
                <Crest team="barca" />
                <h2>BARÇA</h2>
                <span className="side-label">AWAY</span>
              </div>
            </section>

            <div className="separator" />

            <section className="prediction">
              <h1>Predict the final score</h1>
              <form onSubmit={submitPrediction}>
                <div className="score-grid">
                  <ScoreControl label="PSG goals" value={home} setValue={setHome} />
                  <ScoreControl label="Barcelona goals" value={away} setValue={setAway} />
                </div>
                <button className="submit" type="submit" disabled={busy}>
                  {busy ? 'Please wait…' : prediction ? 'Update prediction' : 'Submit prediction'}
                </button>
              </form>

              {prediction && (
                <div className="confirmation">
                  <strong>Your prediction: PSG {prediction.prediction_home}–{prediction.prediction_away} Barcelona</strong>
                  <p>Saved to your student account and shared database.</p>
                  <p>
                    Predicted result:{' '}
                    {prediction.prediction_home === prediction.prediction_away
                      ? 'Draw'
                      : prediction.prediction_home > prediction.prediction_away
                      ? 'PSG win'
                      : 'Barcelona win'}
                  </p>
                </div>
              )}

              {notice && <div className="notice" role="status">{notice}</div>}

              {/* Minimal footer action row to edit details or reset session */}
              <div className="footer-actions">
                <button
                  onClick={() => setEditModalOpen(true)}
                  className="text-action"
                  title="Click to edit your details"
                >
                  {studentProfile.full_name} ({studentProfile.department}, {studentProfile.year}) · Edit details
                </button>
                <button onClick={signOutAndReset} className="text-action">Reset session</button>
                <button onClick={openLeaderboard} className="text-action">Leaderboard</button>
              </div>
            </section>
          </>
        )}

        {/* Edit Student Details Modal */}
        {editModalOpen && (
          <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) setEditModalOpen(false); }}>
            <section className="modal" role="dialog" aria-modal="true" aria-labelledby="edit-details-heading">
              <button className="close" onClick={() => setEditModalOpen(false)} aria-label="Close">×</button>
              <h2 id="edit-details-heading">Edit Student Details</h2>
              <p>Update your college details associated with your prediction.</p>
              {notice && <div className="notice" role="alert" style={{ marginBottom: '14px' }}>{notice}</div>}
              <form onSubmit={saveStudentProfile}>
                <label>
                  Full Name
                  <input
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    required
                    maxLength={60}
                    disabled={busy}
                  />
                </label>
                <label>
                  Department
                  <select
                    value={department}
                    onChange={e => setDepartment(e.target.value)}
                    required
                    disabled={busy}
                  >
                    {DEPARTMENTS.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Year
                  <select
                    value={year}
                    onChange={e => setYear(e.target.value)}
                    required
                    disabled={busy}
                  >
                    {YEARS.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Class / Division
                  <input
                    value={classDivision}
                    onChange={e => setClassDivision(e.target.value)}
                    required
                    maxLength={20}
                    disabled={busy}
                  />
                </label>
                <button className="submit" type="submit" disabled={busy}>
                  {busy ? 'Saving…' : 'Save Details'}
                </button>
              </form>
            </section>
          </div>
        )}

        {/* Student Leaderboard Modal */}
        {leaderboardOpen && (
          <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) setLeaderboardOpen(false); }}>
            <section className="modal leaderboard-modal" role="dialog" aria-modal="true" aria-labelledby="leaderboard-heading">
              <button className="close" onClick={() => setLeaderboardOpen(false)} aria-label="Close">×</button>
              <h2 id="leaderboard-heading">Student Leaderboard</h2>
              <p>Rankings are based on points calculated from the official match result.</p>
              {loadingLeaderboard ? (
                <p>Loading leaderboard…</p>
              ) : leaderboard.length ? (
                <ol className="rank-list">
                  {leaderboard.map((row, i) => (
                    <li key={`${row.display_name || row.full_name}-${i}`}>
                      <div>
                        <span>{row.display_name || row.full_name}</span>
                        <div className="student-badge">
                          {row.department} · {row.year} {row.class_division ? `· ${row.class_division}` : ''}
                        </div>
                      </div>
                      <b>{row.points ?? 0} pts</b>
                      <small>Prediction: {row.prediction_home ?? '-'}–{row.prediction_away ?? '-'}</small>
                    </li>
                  ))}
                </ol>
              ) : (
                <p>No predictions ranked yet. Check back once scores are submitted and results verified.</p>
              )}
            </section>
          </div>
        )}
      </main>
    </>
  );
}

function ScoreControl({ label, value, setValue }) {
  return (
    <div className="score-control">
      <h2>{label}</h2>
      <div className="stepper">
        <button type="button" aria-label={`Decrease ${label}`} onClick={() => setValue(v => Math.max(0, v - 1))}>−</button>
        <output>{value}</output>
        <button type="button" aria-label={`Increase ${label}`} onClick={() => setValue(v => Math.min(9, v + 1))}>+</button>
      </div>
    </div>
  );
}
