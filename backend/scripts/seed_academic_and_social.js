require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Course = require('../models/Course');
const Professor = require('../models/Professor');
const Review = require('../models/Review');
const Resource = require('../models/Resource');
const StudyGroup = require('../models/StudyGroup');
const { Event } = require('../models/Event');
const Community = require('../models/Community');

const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/uniconnect';

async function seedData() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGO_URI);
  console.log('Connected.');

  // Find users for authorship
  const falcon = await User.findOne({ username: 'quietfalcon' });
  const owl = await User.findOne({ username: 'quietowl' });
  const bytefox = await User.findOne({ username: 'bytefox' });
  const profTuring = await User.findOne({ username: 'prof_turing' });
  const dean = await User.findOne({ username: 'campus_dean' });

  if (!falcon || !owl) {
    console.error('Core users not found. Please run seed.js first.');
    process.exit(1);
  }

  const authors = [falcon._id, owl._id, bytefox?._id || falcon._id];

  // ─── 1. SEED COURSES ────────────────────────────────────────────────────────
  console.log('Seeding Courses...');
  const coursesData = [
    {
      code: 'CS101',
      name: 'Intro to Computer Science & Python',
      department: 'Computer Science',
      description: 'Fundamental programming principles, control flow, functions, recursion, and object-oriented design in Python.',
      credits: 4,
      professors: ['Dr. Alan Turing', 'Dr. Ada Lovelace'],
    },
    {
      code: 'CS201',
      name: 'Data Structures and Algorithms',
      department: 'Computer Science',
      description: 'Abstract data types, dynamic arrays, balanced search trees, hash tables, sorting algorithms, and asymptotic complexity.',
      credits: 4,
      professors: ['Dr. Donald Knuth'],
    },
    {
      code: 'CS340',
      name: 'Operating Systems & System Programming',
      department: 'Computer Science',
      description: 'Kernel architectures, processes and threads, virtual memory management, file systems, and concurrency primitives in C/C++.',
      credits: 4,
      professors: ['Dr. Alan Turing'],
    },
    {
      code: 'CS480',
      name: 'Applied Machine Learning',
      department: 'Computer Science',
      description: 'Supervised and unsupervised learning, gradient descent, deep neural networks, model evaluation, and modern PyTorch pipelines.',
      credits: 3,
      professors: ['Dr. Grace Hopper'],
    },
    {
      code: 'MATH201',
      name: 'Linear Algebra & Matrix Theory',
      department: 'Mathematics',
      description: 'Vector spaces, linear transformations, eigenvalues and eigenvectors, singular value decomposition, and numerical methods.',
      credits: 3,
      professors: ['Dr. Richard Feynman'],
    },
    {
      code: 'PHYS101',
      name: 'Classical Mechanics & Thermodynamics',
      department: 'Physics',
      description: 'Newtonian mechanics, conservation laws, rotational dynamics, harmonic oscillation, and introductory thermodynamics.',
      credits: 4,
      professors: ['Dr. Richard Feynman'],
    },
  ];

  const courses = [];
  for (const c of coursesData) {
    const doc = await Course.findOneAndUpdate({ code: c.code }, c, { upsert: true, new: true });
    courses.push(doc);
    console.log(`  + Course: ${doc.code} - ${doc.name}`);
  }

  // ─── 2. SEED PROFESSORS ────────────────────────────────────────────────────
  console.log('Seeding Professors...');
  const profsData = [
    {
      name: 'Dr. Alan Turing',
      department: 'Computer Science',
      title: 'Full Professor & Chair',
      email: 'turing@college.edu',
      courses: ['CS101', 'CS340'],
      avgRating: 4.8,
      avgDifficulty: 3.5,
      wouldTakeAgainPercent: 92,
    },
    {
      name: 'Dr. Donald Knuth',
      department: 'Computer Science',
      title: 'Distinguished Professor',
      email: 'knuth@college.edu',
      courses: ['CS201'],
      avgRating: 4.6,
      avgDifficulty: 4.5,
      wouldTakeAgainPercent: 88,
    },
    {
      name: 'Dr. Grace Hopper',
      department: 'Computer Science',
      title: 'Associate Professor',
      email: 'hopper@college.edu',
      courses: ['CS480'],
      avgRating: 4.9,
      avgDifficulty: 3.8,
      wouldTakeAgainPercent: 96,
    },
    {
      name: 'Dr. Ada Lovelace',
      department: 'Computer Science',
      title: 'Assistant Professor',
      email: 'lovelace@college.edu',
      courses: ['CS101'],
      avgRating: 4.7,
      avgDifficulty: 2.8,
      wouldTakeAgainPercent: 94,
    },
    {
      name: 'Dr. Richard Feynman',
      department: 'Physics',
      title: 'Senior Lecturer',
      email: 'feynman@college.edu',
      courses: ['PHYS101', 'MATH201'],
      avgRating: 5.0,
      avgDifficulty: 3.2,
      wouldTakeAgainPercent: 100,
    },
  ];

  const professors = [];
  for (const p of profsData) {
    const doc = await Professor.findOneAndUpdate({ name: p.name }, p, { upsert: true, new: true });
    professors.push(doc);
    console.log(`  + Professor: ${doc.name} (${doc.department})`);
  }

  // ─── 3. SEED REVIEWS ────────────────────────────────────────────────────────
  console.log('Seeding Reviews...');
  const reviewsData = [
    {
      targetType: 'course',
      course: courses[2]._id, // CS340
      author: falcon._id,
      rating: 5,
      difficulty: 4,
      wouldTakeAgain: true,
      grade: 'A',
      content: 'CS340 is the single best course I have taken in college. The virtual memory assignment in C requires grit, but you come out truly understanding how operating systems schedule hardware.',
      tags: ['Tough Grader', 'Amazing Lectures', 'Heavy Homework'],
      helpfulCount: 24,
    },
    {
      targetType: 'course',
      course: courses[1]._id, // CS201
      author: owl._id,
      rating: 5,
      difficulty: 4,
      wouldTakeAgain: true,
      grade: 'A+',
      content: 'Mastering binary search trees, graph algorithms, and dynamic programming directly prepared me for technical coding interviews. Start programming homework early!',
      tags: ['Clear Grading', 'Great Feedback', 'Practical'],
      helpfulCount: 18,
    },
    {
      targetType: 'course',
      course: courses[3]._id, // CS480
      author: bytefox ? bytefox._id : falcon._id,
      rating: 5,
      difficulty: 3,
      wouldTakeAgain: true,
      grade: 'A',
      content: 'Prof Hopper makes deep neural networks intuitive. Excellent balance of mathematical rigor and hands-on PyTorch lab notebooks.',
      tags: ['Inspirational', 'Modern Tech', 'Project Based'],
      helpfulCount: 15,
    },
    {
      targetType: 'professor',
      professor: professors[0]._id, // Dr. Alan Turing
      author: owl._id,
      rating: 5,
      difficulty: 3,
      wouldTakeAgain: true,
      grade: 'A',
      content: 'Dr. Turing has endless patience in office hours and answers forum questions within minutes. Truly one of the finest instructors on campus.',
      tags: ['Cares About Students', 'Respected', 'Helpful Office Hours'],
      helpfulCount: 31,
    },
    {
      targetType: 'professor',
      professor: professors[1]._id, // Dr. Donald Knuth
      author: falcon._id,
      rating: 4,
      difficulty: 5,
      wouldTakeAgain: true,
      grade: 'B+',
      content: 'Demands deep algorithmic thinking and rigorous mathematical proofs. You will work hard, but you will learn more than anywhere else.',
      tags: ['Strict', 'Genius', 'Lots of Homework'],
      helpfulCount: 22,
    },
  ];

  for (const r of reviewsData) {
    await Review.findOneAndUpdate(
      { author: r.author, targetType: r.targetType, course: r.course || null, professor: r.professor || null },
      r,
      { upsert: true }
    );
    console.log(`  + Review on ${r.targetType}`);
  }

  // Update course/professor stats
  for (const c of courses) {
    const revs = await Review.find({ course: c._id });
    if (revs.length > 0) {
      const avgR = revs.reduce((acc, x) => acc + x.rating, 0) / revs.length;
      const avgD = revs.reduce((acc, x) => acc + x.difficulty, 0) / revs.length;
      await Course.findByIdAndUpdate(c._id, {
        avgRating: Math.round(avgR * 10) / 10,
        avgDifficulty: Math.round(avgD * 10) / 10,
        reviewsCount: revs.length,
      });
    }
  }

  // ─── 4. SEED RESOURCES ──────────────────────────────────────────────────────
  console.log('Seeding Resources...');
  const resourcesData = [
    {
      title: 'CS340 Operating Systems: Complete Exam Cheatsheet & Memory Layouts',
      description: 'Comprehensive 6-page summary covering page tables, TLB cache hit calculation, thread sync locks, mutex vs semaphore, and Unix syscalls.',
      course: courses[2]._id,
      courseCode: 'CS340',
      category: 'cheatsheet',
      semester: 'Fall 2025',
      author: falcon._id,
      fileUrl: '/uploads/sample_cheatsheet.pdf',
      fileName: 'CS340_Final_Cheatsheet_V2.pdf',
      fileType: 'pdf',
      fileSize: 1024 * 1024 * 2.4, // 2.4 MB
      downloadsCount: 142,
      upvotesCount: 89,
      tags: ['CS340', 'Cheatsheet', 'Exams', 'OS'],
    },
    {
      title: 'CS201 Data Structures: LeetCode Pattern Guide & Algorithm Notes',
      description: 'Handwritten typed notes with diagrams for BFS/DFS graph traversals, Dijkstra, 2-pointer sliding window, and Dynamic Programming templates.',
      course: courses[1]._id,
      courseCode: 'CS201',
      category: 'lecture_notes',
      semester: 'Spring 2025',
      author: owl._id,
      fileUrl: '/uploads/sample_algo_notes.pdf',
      fileName: 'CS201_Algorithms_Mastery.pdf',
      fileType: 'pdf',
      fileSize: 1024 * 1024 * 4.1,
      downloadsCount: 230,
      upvotesCount: 154,
      tags: ['CS201', 'Data Structures', 'Algorithms', 'Notes'],
    },
    {
      title: 'MATH201 Linear Algebra: Past Midterm Exams with Solutions (2022-2025)',
      description: 'Archived midterm papers containing eigenvalue proofs, Gram-Schmidt orthogonalization step-by-step walkthroughs, and solution keys.',
      course: courses[4]._id,
      courseCode: 'MATH201',
      category: 'past_exam',
      semester: 'Fall 2025',
      author: falcon._id,
      fileUrl: '/uploads/math201_midterms.pdf',
      fileName: 'MATH201_Midterms_Archive.pdf',
      fileType: 'pdf',
      fileSize: 1024 * 1024 * 3.7,
      downloadsCount: 95,
      upvotesCount: 63,
      tags: ['MATH201', 'Midterms', 'Solutions', 'Linear Algebra'],
    },
    {
      title: 'CS480 Machine Learning: PyTorch Lab 1-5 Solution Notebooks & Cheatsheet',
      description: 'Clean annotated Jupyter Notebook walkthroughs covering backprop from scratch, CNN image classifier, and Transformer attention mechanisms.',
      course: courses[3]._id,
      courseCode: 'CS480',
      category: 'assignment',
      semester: 'Spring 2026',
      author: bytefox ? bytefox._id : falcon._id,
      fileUrl: '/uploads/ml_pytorch_labs.zip',
      fileName: 'CS480_PyTorch_Labs.zip',
      fileType: 'zip',
      fileSize: 1024 * 1024 * 8.5,
      downloadsCount: 112,
      upvotesCount: 77,
      tags: ['PyTorch', 'Machine Learning', 'CS480', 'Labs'],
    },
    {
      title: 'PHYS101 Formula Sheet & Mechanics Quick Reference Guide',
      description: 'Essential physics formulas for kinematics, rotational inertia formulas, fluid dynamics, and thermodynamics cheat sheet.',
      course: courses[5]._id,
      courseCode: 'PHYS101',
      category: 'cheatsheet',
      semester: 'Spring 2026',
      author: owl._id,
      fileUrl: '/uploads/phys101_formulas.pdf',
      fileName: 'PHYS101_Formula_Sheet.pdf',
      fileType: 'pdf',
      fileSize: 1024 * 1024 * 1.2,
      downloadsCount: 78,
      upvotesCount: 41,
      tags: ['PHYS101', 'Formulas', 'Physics', 'Mechanics'],
    },
  ];

  for (const resItem of resourcesData) {
    await Resource.findOneAndUpdate({ title: resItem.title }, resItem, { upsert: true });
    console.log(`  + Resource: ${resItem.title.slice(0, 45)}...`);
  }

  // ─── 5. SEED STUDY GROUPS ──────────────────────────────────────────────────
  console.log('Seeding Study Groups...');
  const studyGroupsData = [
    {
      name: 'CS340 Kernel Slayers: Virtual Memory Lab Sprint',
      description: 'Weekly in-person deep dive focused on the virtual memory paging assignment and debugging multi-threaded C concurrency locks.',
      course: courses[2]._id,
      courseCode: 'CS340',
      topic: 'Virtual Memory & Page Replacement Algorithms',
      creator: falcon._id,
      members: [
        { user: falcon._id, role: 'admin' },
        { user: owl._id, role: 'member' },
      ],
      maxMembers: 12,
      meetingSchedule: 'Tuesdays & Thursdays @ 6:00 PM',
      meetingType: 'in_person',
      location: 'Science Library - Group Room 3B',
      status: 'active',
    },
    {
      name: 'LeetCode & Technical Interview Preparation Cohort',
      description: 'Solving 2 medium LeetCode algorithmic problems daily, conducting peer mock interviews, and preparing for summer software engineering roles.',
      course: courses[1]._id,
      courseCode: 'CS201',
      topic: 'Graph Algorithms, Dynamic Programming, System Design',
      creator: owl._id,
      members: [
        { user: owl._id, role: 'admin' },
        { user: falcon._id, role: 'member' },
        { user: bytefox ? bytefox._id : falcon._id, role: 'member' },
      ],
      maxMembers: 20,
      meetingSchedule: 'Mon, Wed, Fri @ 7:30 PM',
      meetingType: 'hybrid',
      location: 'Engineering Building Room 204 & Google Meet',
      meetingLink: 'https://meet.google.com/xyz-uniconnect-mock',
      status: 'active',
    },
    {
      name: 'MATH201 Proofs & Matrix Theory Discussion Group',
      description: 'Reviewing homework problem sets, understanding abstract vector space theorems, and prepping for the upcoming departmental midterm.',
      course: courses[4]._id,
      courseCode: 'MATH201',
      topic: 'Spectral Theorem & SVD Decomposition',
      creator: falcon._id,
      members: [
        { user: falcon._id, role: 'admin' },
        { user: owl._id, role: 'member' },
      ],
      maxMembers: 8,
      meetingSchedule: 'Sundays @ 3:00 PM',
      meetingType: 'in_person',
      location: 'Student Union Quiet Lounge (2nd Floor)',
      status: 'active',
    },
    {
      name: 'CS480 Deep Learning Paper Reading Group',
      description: 'Reading seminal papers in computer vision, LLM attention mechanisms, and reinforcement learning. Everyone presents one paper per semester.',
      course: courses[3]._id,
      courseCode: 'CS480',
      topic: 'Transformers, Diffusion Models & Neural Rendering',
      creator: bytefox ? bytefox._id : falcon._id,
      members: [
        { user: bytefox ? bytefox._id : falcon._id, role: 'admin' },
        { user: falcon._id, role: 'member' },
      ],
      maxMembers: 15,
      meetingSchedule: 'Wednesdays @ 5:00 PM',
      meetingType: 'virtual',
      meetingLink: 'https://meet.google.com/cs480-reading-group',
      status: 'active',
    },
  ];

  for (const sg of studyGroupsData) {
    await StudyGroup.findOneAndUpdate({ name: sg.name }, sg, { upsert: true });
    console.log(`  + Study Group: ${sg.name.slice(0, 45)}...`);
  }

  // ─── 6. SEED EVENTS ────────────────────────────────────────────────────────
  console.log('Seeding Events...');
  const csCommunity = await Community.findOne({ slug: 'cs-department' });
  const campusCommunity = await Community.findOne({ slug: 'campus-life' });
  const careerCommunity = await Community.findOne({ slug: 'career-advice' });

  const now = new Date();
  const day = 24 * 60 * 60 * 1000;

  const eventsData = [
    {
      title: 'Annual Spring Hackathon: Build with AI 2026',
      description: '36 hours of non-stop building, mentoring, and prizes! Over $15,000 in cash awards, cloud credits, hardware kits, and free meals all weekend. Open to all students regardless of major.',
      organizer: falcon._id,
      community: csCommunity?._id || null,
      category: 'academic',
      format: 'in_person',
      location: 'Grand Ballroom & Student Center Innovation Hub',
      startDate: new Date(now.getTime() + 5 * day),
      endDate: new Date(now.getTime() + 7 * day),
      capacity: 350,
      attendees: [
        { user: falcon._id, status: 'going' },
        { user: owl._id, status: 'going' },
      ],
      attendeeCount: 148,
      tags: ['hackathon', 'ai', 'coding', 'prizes', 'free-food'],
      coverImage: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=800&auto=format&fit=crop&q=60',
    },
    {
      title: 'Spring Campus Career Fair: Tech & Engineering',
      description: 'Meet recruiters from top tech companies, startups, and research labs. Bring 15+ printed copies of your resume. Professional or business casual attire recommended.',
      organizer: dean ? dean._id : falcon._id,
      community: careerCommunity?._id || null,
      category: 'career',
      format: 'in_person',
      location: 'University Gymnasium & North Fieldhouse',
      startDate: new Date(now.getTime() + 9 * day),
      endDate: new Date(now.getTime() + 9 * day + 6 * 60 * 60 * 1000),
      capacity: 1000,
      attendees: [
        { user: owl._id, status: 'going' },
        { user: falcon._id, status: 'going' },
      ],
      attendeeCount: 420,
      tags: ['career', 'jobs', 'internships', 'networking'],
      coverImage: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?w=800&auto=format&fit=crop&q=60',
    },
    {
      title: 'Full-Stack React & Node.js Production Workshop',
      description: 'Hands-on interactive masterclass building a responsive web app with Vite, Tailwind/Vanilla CSS, Express, MongoDB Atlas, and Vercel cloud deployment.',
      organizer: profTuring ? profTuring._id : owl._id,
      community: csCommunity?._id || null,
      category: 'workshop',
      format: 'hybrid',
      location: 'Computer Science Hall Room 105 & YouTube Live',
      virtualLink: 'https://youtube.com/live/uniconnect-workshop',
      startDate: new Date(now.getTime() + 3 * day),
      endDate: new Date(now.getTime() + 3 * day + 3 * 60 * 60 * 1000),
      capacity: 120,
      attendees: [
        { user: owl._id, status: 'going' },
        { user: falcon._id, status: 'going' },
      ],
      attendeeCount: 88,
      tags: ['workshop', 'react', 'webdev', 'mongodb'],
      coverImage: 'https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&auto=format&fit=crop&q=60',
    },
    {
      title: 'Campus Sunset Movie & Bonfire Night',
      description: 'Join hundreds of students on the South Lawn for wood-fired s’mores, hot cider, lawn games, and an outdoor movie screening of Interstellar on the massive inflatable screen.',
      organizer: owl._id,
      community: campusCommunity?._id || null,
      category: 'social',
      format: 'in_person',
      location: 'South Quad Grass Lawn (behind Arts Center)',
      startDate: new Date(now.getTime() + 2 * day),
      endDate: new Date(now.getTime() + 2 * day + 4 * 60 * 60 * 1000),
      capacity: 500,
      attendees: [
        { user: owl._id, status: 'going' },
        { user: falcon._id, status: 'going' },
      ],
      attendeeCount: 260,
      tags: ['social', 'bonfire', 'movie', 'smores', 'relax'],
      coverImage: 'https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?w=800&auto=format&fit=crop&q=60',
    },
    {
      title: 'Inter-Department Football Tournament Finals',
      description: 'The championship match of the spring intramural season! Computer Science vs Mechanical Engineering for the campus trophy and bragging rights.',
      organizer: falcon._id,
      community: campusCommunity?._id || null,
      category: 'sports',
      format: 'in_person',
      location: 'Campus Athletic Stadium & Bleachers',
      startDate: new Date(now.getTime() + 6 * day),
      endDate: new Date(now.getTime() + 6 * day + 2 * 60 * 60 * 1000),
      capacity: 800,
      attendees: [
        { user: falcon._id, status: 'going' },
      ],
      attendeeCount: 310,
      tags: ['sports', 'football', 'tournament', 'campus-cup'],
      coverImage: 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=800&auto=format&fit=crop&q=60',
    },
  ];

  for (const ev of eventsData) {
    await Event.findOneAndUpdate({ title: ev.title }, ev, { upsert: true });
    console.log(`  + Event: ${ev.title.slice(0, 45)}...`);
  }

  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎉 Reviews, Resources, Study Groups & Events Seeded Successfully!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  await mongoose.disconnect();
  console.log('MongoDB disconnected.');
}

seedData().catch((err) => {
  console.error('Seeding error:', err);
  process.exit(1);
});
