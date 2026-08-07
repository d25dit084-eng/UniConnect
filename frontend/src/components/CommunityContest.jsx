import React, { useState } from 'react';

export const CommunityContest = () => {
  const [activeChallenge, setActiveChallenge] = useState(null); // 'leetcode', 'puzzle', 'wordle' or null

  const challenges = [
    {
      id: 'leetcode',
      title: 'LeetCode Challenge',
      subtitle: '128 participants',
      percentage: 80,
      description: 'Pick a problem, solve it, and share your approach.',
      btnLabel: 'View Challenge →'
    },
    {
      id: 'puzzle',
      title: 'Puzzle Challenge',
      subtitle: '96 participants',
      percentage: 65,
      description: 'Can you solve the puzzle before everyone else?',
      btnLabel: 'Try Puzzle →'
    },
    {
      id: 'wordle',
      title: 'Guess the Word',
      subtitle: '214 players',
      percentage: 90,
      description: 'One word. Six attempts. How quickly can you guess it?',
      btnLabel: 'Play →'
    }
  ];

  return (
    <div>
      <div style={{ border: '1px solid #e0e0e0', padding: '16px', background: '#ffffff', borderRadius: '4px', marginBottom: '20px' }}>
        <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: '#111111', fontWeight: 'bold', marginBottom: '12px', letterSpacing: '0.05em' }}>
          Community Challenges
        </h4>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {challenges.map((c) => (
            <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#1a1a1a' }}>{c.title}</div>
              <div style={{ fontSize: '11px', color: '#666666' }}>{c.subtitle}</div>
              
              {/* Thin horizontal progress bar */}
              <div style={{ height: '4px', background: '#f0f0f0', borderRadius: '2px', overflow: 'hidden', width: '100%' }}>
                <div style={{ height: '100%', width: `${c.percentage}%`, background: '#1a1a1a' }} />
              </div>

              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => setActiveChallenge(c.id)}
                style={{ alignSelf: 'flex-start', fontSize: '11px', padding: '3px 8px', height: 'auto', marginTop: '2px' }}
              >
                {c.btnLabel}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Challenge Interactive Demo Modal */}
      {activeChallenge && (
        <div className="modal-overlay" onClick={() => setActiveChallenge(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '10px', borderBottom: '1px solid #e2e0db', paddingBottom: '6px' }}>
              {activeChallenge === 'leetcode' && 'LeetCode Challenge: Reverse String'}
              {activeChallenge === 'puzzle' && 'Puzzle Challenge: Codebreaker Matrix'}
              {activeChallenge === 'wordle' && 'Guess the Word: Wordle Demo'}
            </h3>

            {activeChallenge === 'leetcode' && (
              <div style={{ fontSize: '12px', color: '#1a1a1a' }}>
                <p style={{ marginBottom: '8px' }}>Write a function that reverses a string. The input string is given as an array of characters.</p>
                <pre style={{ background: '#fbfaf8', padding: '8px', border: '1px solid #e2e0db', fontSize: '11px', overflowX: 'auto', marginBottom: '12px' }}>
{`// JavaScript Starter
function reverseString(s) {
  let left = 0, right = s.length - 1;
  while (left < right) {
    [s[left], s[right]] = [s[right], s[left]];
    left++;
    right--;
  }
}`}
                </pre>
                <div style={{ color: '#090', fontWeight: 'bold' }}>✓ Solution Compiled (Demo Mode)</div>
              </div>
            )}

            {activeChallenge === 'puzzle' && (
              <div style={{ fontSize: '12px', color: '#1a1a1a' }}>
                <p style={{ marginBottom: '8px' }}>A numeric matrix contains a pattern. Find the missing value to unlock the system code.</p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 40px)', gap: '5px', margin: '10px 0', justifyContent: 'center' }}>
                  {[2, 4, 8, 3, 9, 27, 4, 16, '?'].map((val, idx) => (
                    <div key={idx} style={{ width: '40px', height: '40px', border: '1px solid #1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', background: val === '?' ? '#eae6df' : '#ffffff' }}>
                      {val}
                    </div>
                  ))}
                </div>
                <p style={{ fontStyle: 'italic', fontSize: '11px', color: '#666666', textAlign: 'center' }}>Tip: Look at powers of numbers row-by-row. (Solution: 64)</p>
              </div>
            )}

            {activeChallenge === 'wordle' && (
              <div style={{ fontSize: '12px', color: '#1a1a1a', textAlign: 'center' }}>
                <p style={{ marginBottom: '10px' }}>Try to guess today's 5-letter word in 6 attempts.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'center', marginBottom: '12px' }}>
                  {['C H A O S', 'P L A Y S', '_ _ _ _ _'].map((word, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: '5px' }}>
                      {word.split(' ').map((char, charIdx) => (
                        <div 
                          key={charIdx} 
                          style={{ 
                            width: '24px', 
                            height: '24px', 
                            border: '1px solid #1a1a1a', 
                            display: 'flex', 
                            alignItems: 'center', 
                            justifyContent: 'center', 
                            fontWeight: 'bold',
                            background: char === '_' ? '#ffffff' : charIdx === 0 && idx === 0 ? '#1a1a1a' : '#eae6df',
                            color: char === '_' ? '#1a1a1a' : charIdx === 0 && idx === 0 ? '#ffffff' : '#1a1a1a'
                          }}
                        >
                          {char}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <div style={{ fontSize: '11px', color: '#666666' }}>Green = correct spot. Grey = wrong letter.</div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px', gap: '8px' }}>
              <button type="button" className="btn-secondary" onClick={() => setActiveChallenge(null)}>
                Close
              </button>
              <button type="button" onClick={() => { alert('Challenge accepted!'); setActiveChallenge(null); }}>
                Accept Challenge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default CommunityContest;
