import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { completeOnboarding } from '../api/userApi';
import { listCommunities } from '../api/communityApi';

const AVAILABLE_INTERESTS = [
  { id: 'ai_coding', label: 'AI & Coding', icon: '💻' },
  { id: 'startups', label: 'Startups & Venture', icon: '🚀' },
  { id: 'hackathons', label: 'Hackathons', icon: '⚡' },
  { id: 'gaming', label: 'Gaming & Esports', icon: '🎮' },
  { id: 'fitness', label: 'Fitness & Sports', icon: '🏋️' },
  { id: 'academics', label: 'Exam Prep & Study', icon: '📚' },
  { id: 'campus_life', label: 'Campus Life & Housing', icon: '🍕' },
  { id: 'arts_design', label: 'Arts & Design', icon: '🎨' },
  { id: 'music', label: 'Music & Concerts', icon: '🎵' },
  { id: 'research', label: 'Lab Research', icon: '🔬' },
];

const DEPARTMENTS = [
  'Computer Science',
  'Electrical & Computer Engineering',
  'Mechanical Engineering',
  'Business Administration',
  'Economics & Finance',
  'Biology & Life Sciences',
  'Mathematics & Statistics',
  'Physics & Chemistry',
  'Psychology & Cognitive Science',
  'Liberal Arts & Humanities',
  'Other / Undeclared',
];

const YEARS = [
  { value: 1, label: 'Freshman (Year 1)' },
  { value: 2, label: 'Sophomore (Year 2)' },
  { value: 3, label: 'Junior (Year 3)' },
  { value: 4, label: 'Senior (Year 4)' },
  { value: 5, label: 'Graduate Student (Master / PhD)' },
];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1: Academics & Profile
  const [department, setDepartment] = useState(user?.department || 'Computer Science');
  const [year, setYear] = useState(user?.year || 1);
  const [bio, setBio] = useState(user?.bio || '');

  // Step 2: Interests
  const [selectedInterests, setSelectedInterests] = useState(user?.interests || []);

  // Step 3: Communities
  const [availableCommunities, setAvailableCommunities] = useState([]);
  const [selectedCommunities, setSelectedCommunities] = useState([]);
  const [loadingCommunities, setLoadingCommunities] = useState(false);

  useEffect(() => {
    const fetchComms = async () => {
      try {
        setLoadingCommunities(true);
        const res = await listCommunities('', 'members');
        if (res.data?.communities) {
          setAvailableCommunities(res.data.communities.slice(0, 8));
          // Pre-select first 3 communities
          setSelectedCommunities(
            res.data.communities.slice(0, 3).map((c) => c._id)
          );
        }
      } catch (e) {
        console.error('Failed to load recommended communities:', e.message);
      } finally {
        setLoadingCommunities(false);
      }
    };

    fetchComms();
  }, []);

  const toggleInterest = (interestId) => {
    setSelectedInterests((prev) =>
      prev.includes(interestId)
        ? prev.filter((i) => i !== interestId)
        : [...prev, interestId]
    );
  };

  const toggleCommunity = (commId) => {
    setSelectedCommunities((prev) =>
      prev.includes(commId)
        ? prev.filter((id) => id !== commId)
        : [...prev, commId]
    );
  };

  const handleFinish = async () => {
    try {
      setLoading(true);
      setError('');

      await completeOnboarding({
        department,
        year: parseInt(year, 10),
        interests: selectedInterests,
        bio: bio.trim(),
        communities: selectedCommunities,
      });

      // Navigate to personalized feed
      navigate('/home');
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Onboarding failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: '680px',
        margin: '40px auto',
        padding: '32px 24px',
        backgroundColor: '#ffffff',
        border: '1px solid #e2e0db',
        borderRadius: '16px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
      }}
    >
      {/* Step Indicator */}
      <div style={{ marginBottom: '28px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            marginBottom: '10px',
          }}
        >
          {['1. Academic Profile', '2. Interests & Passions', '3. Join Communities'].map(
            (label, idx) => (
              <span
                key={label}
                style={{
                  fontSize: '13px',
                  fontWeight: step === idx + 1 ? '700' : '500',
                  color: step === idx + 1 ? '#1a1a1a' : '#888',
                }}
              >
                {label}
              </span>
            )
          )}
        </div>
        <div
          style={{
            width: '100%',
            height: '6px',
            backgroundColor: '#f0eee6',
            borderRadius: '3px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${(step / 3) * 100}%`,
              backgroundColor: '#1a1a1a',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {error && (
        <div
          style={{
            padding: '10px 14px',
            backgroundColor: '#fee2e2',
            color: '#b91c1c',
            borderRadius: '8px',
            fontSize: '13px',
            marginBottom: '20px',
          }}
        >
          {error}
        </div>
      )}

      {/* STEP 1: Academic Profile */}
      {step === 1 && (
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: '800', margin: '0 0 6px 0' }}>
            🎓 Welcome to UniConnect!
          </h2>
          <p style={{ color: '#666', fontSize: '14px', margin: '0 0 24px 0' }}>
            Set up your collegiate profile so campus classmates can recognize your academic interests.
          </p>

          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '600',
                marginBottom: '6px',
              }}
            >
              Academic Department / Major
            </label>
            <select
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #d4d2cc',
                fontSize: '14px',
                backgroundColor: '#faf8f5',
              }}
            >
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '600',
                marginBottom: '6px',
              }}
            >
              Academic Year
            </label>
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #d4d2cc',
                fontSize: '14px',
                backgroundColor: '#faf8f5',
              }}
            >
              {YEARS.map((yr) => (
                <option key={yr.value} value={yr.value}>
                  {yr.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label
              style={{
                display: 'block',
                fontSize: '13px',
                fontWeight: '600',
                marginBottom: '6px',
              }}
            >
              Short Bio (Optional)
            </label>
            <textarea
              rows="3"
              placeholder="e.g. CS Sophomore interested in distributed systems, looking for study buddies!"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #d4d2cc',
                fontSize: '14px',
                resize: 'vertical',
                backgroundColor: '#faf8f5',
              }}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              type="button"
              onClick={() => setStep(2)}
              style={{
                padding: '10px 24px',
                backgroundColor: '#1a1a1a',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Next: Choose Interests →
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: Interests */}
      {step === 2 && (
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: '800', margin: '0 0 6px 0' }}>
            ✨ What are you interested in?
          </h2>
          <p style={{ color: '#666', fontSize: '14px', margin: '0 0 20px 0' }}>
            Select topics and activities to tailor your campus feed recommendations.
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '12px',
              marginBottom: '28px',
            }}
          >
            {AVAILABLE_INTERESTS.map((interest) => {
              const isSelected = selectedInterests.includes(interest.id);
              return (
                <button
                  key={interest.id}
                  type="button"
                  onClick={() => toggleInterest(interest.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 14px',
                    borderRadius: '10px',
                    border: '1px solid',
                    borderColor: isSelected ? '#1a1a1a' : '#e2e0db',
                    backgroundColor: isSelected ? '#f5f4ef' : '#ffffff',
                    color: '#1a1a1a',
                    fontWeight: isSelected ? '700' : '500',
                    fontSize: '13px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: '18px' }}>{interest.icon}</span>
                  <span style={{ flex: 1 }}>{interest.label}</span>
                  {isSelected && <span style={{ color: '#15803d' }}>✓</span>}
                </button>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button
              type="button"
              onClick={() => setStep(1)}
              style={{
                padding: '10px 20px',
                backgroundColor: '#f3f2ee',
                border: '1px solid #d4d2cc',
                borderRadius: '8px',
                fontWeight: '600',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              style={{
                padding: '10px 24px',
                backgroundColor: '#1a1a1a',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              Next: Join Communities →
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: Communities */}
      {step === 3 && (
        <div>
          <h2 style={{ fontSize: '22px', fontWeight: '800', margin: '0 0 6px 0' }}>
            👥 Join Campus Communities
          </h2>
          <p style={{ color: '#666', fontSize: '14px', margin: '0 0 20px 0' }}>
            Select popular communities to subscribe to their announcements and discussions.
          </p>

          {loadingCommunities ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: '#666' }}>
              Loading recommended communities...
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                maxHeight: '320px',
                overflowY: 'auto',
                marginBottom: '28px',
                paddingRight: '6px',
              }}
            >
              {availableCommunities.map((comm) => {
                const isSelected = selectedCommunities.includes(comm._id);
                return (
                  <div
                    key={comm._id}
                    onClick={() => toggleCommunity(comm._id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 16px',
                      borderRadius: '10px',
                      border: '1px solid',
                      borderColor: isSelected ? '#1a1a1a' : '#e2e0db',
                      backgroundColor: isSelected ? '#faf8f5' : '#ffffff',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '14px' }}>
                        c/{comm.name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#666' }}>
                        {comm.description || comm.displayName}
                      </div>
                    </div>
                    <div
                      style={{
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontSize: '12px',
                        fontWeight: '600',
                        backgroundColor: isSelected ? '#1a1a1a' : '#f3f2ee',
                        color: isSelected ? '#ffffff' : '#333333',
                      }}
                    >
                      {isSelected ? '✓ Joined' : '+ Join'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button
              type="button"
              onClick={() => setStep(2)}
              style={{
                padding: '10px 20px',
                backgroundColor: '#f3f2ee',
                border: '1px solid #d4d2cc',
                borderRadius: '8px',
                fontWeight: '600',
                fontSize: '14px',
                cursor: 'pointer',
              }}
            >
              ← Back
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleFinish}
              style={{
                padding: '10px 28px',
                backgroundColor: '#1a1a1a',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '14px',
                cursor: loading ? 'wait' : 'pointer',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Setting up...' : 'Complete & Go to Feed 🎉'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
