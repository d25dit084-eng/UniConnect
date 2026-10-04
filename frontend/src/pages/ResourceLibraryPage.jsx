import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getResources,
  createResource,
  downloadResource,
  voteResource,
  deleteResource,
} from '../api/resourceApi';

const CATEGORIES = [
  { id: '', label: 'All Resources' },
  { id: 'lecture_notes', label: '📚 Lecture Notes' },
  { id: 'past_exam', label: '📝 Past Exams' },
  { id: 'cheatsheet', label: '🧠 Cheatsheets' },
  { id: 'syllabus', label: '📑 Syllabus' },
  { id: 'assignment', label: '📋 Assignments' },
  { id: 'other', label: '📦 Other' },
];

export const ResourceLibraryPage = () => {
  const { user, isAuthenticated } = useAuth();

  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [sortBy, setSortBy] = useState('recent');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Upload Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadCourseCode, setUploadCourseCode] = useState('');
  const [uploadCategory, setUploadCategory] = useState('lecture_notes');
  const [uploadSemester, setUploadSemester] = useState('');
  const [uploadFileName, setUploadFileName] = useState('');
  const [uploadFileUrl, setUploadFileUrl] = useState('');
  const [uploadFileType, setUploadFileType] = useState('pdf');
  const [uploadTags, setUploadTags] = useState('');
  const [uploadAnonymous, setUploadAnonymous] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  const fetchResourcesList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getResources({
        search: search.trim() || undefined,
        category: selectedCategory || undefined,
        courseCode: selectedCourse.trim() || undefined,
        sort: sortBy,
        page,
        limit: 15,
      });

      setResources(data.resources || []);
      setTotalPages(data.pagination?.pages || 1);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load resources');
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory, selectedCourse, sortBy, page]);

  useEffect(() => {
    fetchResourcesList();
  }, [fetchResourcesList]);

  const handleDownload = async (resource) => {
    try {
      const data = await downloadResource(resource._id);
      // Optimistically increment download count
      setResources((prev) =>
        prev.map((r) =>
          r._id === resource._id
            ? { ...r, downloadsCount: (r.downloadsCount || 0) + 1 }
            : r
        )
      );
      // Open file in new tab or download
      if (data.fileUrl) {
        window.open(data.fileUrl, '_blank', 'noopener,noreferrer');
      }
    } catch (err) {
      alert(`Download failed: ${err.response?.data?.message || err.message}`);
    }
  };

  const handleVote = async (resourceId) => {
    if (!isAuthenticated) {
      alert('Please log in to upvote resources.');
      return;
    }
    try {
      const res = await voteResource(resourceId);
      setResources((prev) =>
        prev.map((r) =>
          r._id === resourceId ? { ...r, upvotesCount: res.upvotesCount } : r
        )
      );
    } catch (err) {
      alert(`Vote failed: ${err.response?.data?.message || err.message}`);
    }
  };

  const handleDelete = async (resourceId) => {
    if (!window.confirm('Are you sure you want to delete this resource?')) return;
    try {
      await deleteResource(resourceId);
      setResources((prev) => prev.filter((r) => r._id !== resourceId));
    } catch (err) {
      alert(`Delete failed: ${err.response?.data?.message || err.message}`);
    }
  };

  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadTitle.trim() || !uploadFileName.trim() || !uploadFileUrl.trim()) {
      setModalError('Title, file name, and file URL are required.');
      return;
    }

    setIsSubmitting(true);
    setModalError('');

    try {
      const tagsArray = uploadTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      await createResource({
        title: uploadTitle.trim(),
        description: uploadDescription.trim(),
        courseCode: uploadCourseCode.trim().toUpperCase(),
        category: uploadCategory,
        semester: uploadSemester.trim(),
        fileName: uploadFileName.trim(),
        fileUrl: uploadFileUrl.trim(),
        fileType: uploadFileType.trim().toLowerCase(),
        tags: tagsArray,
        isAnonymous: uploadAnonymous,
      });

      setIsModalOpen(false);
      // Reset form
      setUploadTitle('');
      setUploadDescription('');
      setUploadCourseCode('');
      setUploadCategory('lecture_notes');
      setUploadSemester('');
      setUploadFileName('');
      setUploadFileUrl('');
      setUploadFileType('pdf');
      setUploadTags('');
      setUploadAnonymous(false);

      // Refresh list
      fetchResourcesList();
    } catch (err) {
      setModalError(err.response?.data?.message || err.message || 'Upload failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '16px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0' }}>
            📚 Academic Resource Library
          </h1>
          <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
            Lecture notes, past exams, study guides, and syllabus archive shared by campus peers.
          </p>
        </div>

        {isAuthenticated && (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            style={{
              padding: '9px 18px',
              backgroundColor: '#1d4ed8',
              color: '#ffffff',
              borderRadius: '6px',
              border: 'none',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>+</span> Upload Resource
          </button>
        )}
      </div>

      {/* Search and Filters Bar */}
      <div
        style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '16px',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <input
          type="text"
          placeholder="Search by title, topic, or tag..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          style={{
            flex: '1 1 200px',
            padding: '8px 14px',
            borderRadius: '6px',
            border: '1px solid #dcdcdc',
            fontSize: '14px',
          }}
        />

        <input
          type="text"
          placeholder="Course code (e.g. CS101)..."
          value={selectedCourse}
          onChange={(e) => {
            setSelectedCourse(e.target.value);
            setPage(1);
          }}
          style={{
            width: '180px',
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid #dcdcdc',
            fontSize: '14px',
            textTransform: 'uppercase',
          }}
        />

        <select
          value={sortBy}
          onChange={(e) => {
            setSortBy(e.target.value);
            setPage(1);
          }}
          style={{
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid #dcdcdc',
            fontSize: '14px',
            backgroundColor: '#fff',
          }}
        >
          <option value="recent">Most Recent</option>
          <option value="downloads">Most Downloaded</option>
          <option value="popular">Most Upvoted</option>
        </select>
      </div>

      {/* Category Pills */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '8px',
          marginBottom: '20px',
        }}
      >
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => {
              setSelectedCategory(cat.id);
              setPage(1);
            }}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              border: selectedCategory === cat.id ? '1px solid #1d4ed8' : '1px solid #e0dfdb',
              backgroundColor: selectedCategory === cat.id ? '#eff6ff' : '#ffffff',
              color: selectedCategory === cat.id ? '#1d4ed8' : '#4b5563',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div
          style={{
            padding: '12px',
            backgroundColor: '#fee2e2',
            color: '#b91c1c',
            borderRadius: '6px',
            marginBottom: '16px',
          }}
        >
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#666' }}>
          Loading resources...
        </div>
      ) : resources.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            backgroundColor: '#faf9f6',
            borderRadius: '8px',
            border: '1px dashed #dcdcdc',
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>📂</div>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '17px', color: '#1a1a1b' }}>
            No resources found
          </h3>
          <p style={{ margin: 0, color: '#777', fontSize: '14px' }}>
            Be the first to share notes or exams for this subject!
          </p>
        </div>
      ) : (
        /* Resources List */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {resources.map((item) => {
            const isOwner =
              user &&
              item.author &&
              (user._id === (item.author._id || item.author) || item.author?.isMine);
            const isAdmin = user && user.role === 'admin';
            const isAnonymous = Boolean(item.isAnonymous);
            const authorDisplay = isAnonymous
              ? item.author?.alias || 'Anonymous'
              : item.author?.username || '[deleted]';

            return (
              <div
                key={item._id}
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '8px',
                  border: '1px solid #e5e5e5',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '12px',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '4px',
                        flexWrap: 'wrap',
                      }}
                    >
                      {item.courseCode && (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: '#e0e7ff',
                            color: '#3730a3',
                          }}
                        >
                          {item.courseCode}
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: '#f3f4f6',
                          color: '#4b5563',
                          textTransform: 'capitalize',
                        }}
                      >
                        {item.category.replace('_', ' ')}
                      </span>
                      {item.semester && (
                        <span style={{ fontSize: '12px', color: '#6b7280' }}>
                          • {item.semester}
                        </span>
                      )}
                    </div>

                    <h3 style={{ margin: '0 0 6px 0', fontSize: '17px', color: '#111827' }}>
                      {item.title}
                    </h3>

                    {item.description && (
                      <p
                        style={{
                          margin: '0 0 8px 0',
                          fontSize: '13px',
                          color: '#4b5563',
                          lineHeight: '1.4',
                        }}
                      >
                        {item.description}
                      </p>
                    )}

                    {Array.isArray(item.tags) && item.tags.length > 0 && (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {item.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            style={{
                              fontSize: '11px',
                              color: '#2563eb',
                              backgroundColor: '#eff6ff',
                              padding: '1px 6px',
                              borderRadius: '4px',
                            }}
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions Column */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: '8px',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => handleDownload(item)}
                      style={{
                        padding: '6px 14px',
                        backgroundColor: '#2563eb',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '13px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>📥</span> Download
                    </button>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        type="button"
                        onClick={() => handleVote(item._id)}
                        disabled={!isAuthenticated}
                        style={{
                          background: 'none',
                          border: '1px solid #e5e5e5',
                          borderRadius: '4px',
                          padding: '3px 8px',
                          cursor: isAuthenticated ? 'pointer' : 'default',
                          fontSize: '12px',
                          color: '#4b5563',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                        title="Upvote resource"
                      >
                        <span>▲</span> {item.upvotesCount || 0}
                      </button>

                      {(isOwner || isAdmin) && (
                        <button
                          type="button"
                          onClick={() => handleDelete(item._id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#dc2626',
                            cursor: 'pointer',
                            fontSize: '12px',
                            padding: '3px 6px',
                          }}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Footer: Metadata and Author */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTop: '1px solid #f3f4f6',
                    paddingTop: '8px',
                    fontSize: '12px',
                    color: '#6b7280',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Shared by</span>
                    {isAnonymous ? (
                      <span style={{ fontStyle: 'italic', color: '#6b7280' }}>
                        {authorDisplay}
                      </span>
                    ) : (
                      <Link
                        to={`/u/${item.author?.username?.replace('u/', '') || 'deleted'}`}
                        style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}
                      >
                        {authorDisplay}
                      </Link>
                    )}
                    <span>• {new Date(item.createdAt).toLocaleDateString()}</span>
                  </div>

                  <div>
                    <span>{item.downloadsCount || 0} downloads</span>
                    <span style={{ marginLeft: '8px' }}>
                      [{item.fileType?.toUpperCase() || 'FILE'}]
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '12px',
            marginTop: '24px',
          }}
        >
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            style={{
              padding: '6px 14px',
              border: '1px solid #dcdcdc',
              background: '#fff',
              borderRadius: '4px',
              cursor: page <= 1 ? 'not-allowed' : 'pointer',
            }}
          >
            Previous
          </button>
          <span style={{ fontSize: '13px', color: '#666' }}>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            style={{
              padding: '6px 14px',
              border: '1px solid #dcdcdc',
              background: '#fff',
              borderRadius: '4px',
              cursor: page >= totalPages ? 'not-allowed' : 'pointer',
            }}
          >
            Next
          </button>
        </div>
      )}

      {/* Upload Resource Modal */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '8px',
              maxWidth: '540px',
              width: '100%',
              padding: '24px',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
              }}
            >
              <h2 style={{ margin: 0, fontSize: '18px' }}>Upload Study Material</h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#fee2e2',
                  color: '#b91c1c',
                  borderRadius: '4px',
                  marginBottom: '12px',
                  fontSize: '13px',
                }}
              >
                {modalError}
              </div>
            )}

            <form onSubmit={handleUploadSubmit}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                  Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CS101 Midterm 2024 Exam & Solutions"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                    Course Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CS101"
                    value={uploadCourseCode}
                    onChange={(e) => setUploadCourseCode(e.target.value.toUpperCase())}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                    Category
                  </label>
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#fff' }}
                  >
                    <option value="lecture_notes">Lecture Notes</option>
                    <option value="past_exam">Past Exam</option>
                    <option value="cheatsheet">Cheatsheet</option>
                    <option value="syllabus">Syllabus</option>
                    <option value="assignment">Assignment</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                    Semester
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Fall 2025"
                    value={uploadSemester}
                    onChange={(e) => setUploadSemester(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                    File Format
                  </label>
                  <select
                    value={uploadFileType}
                    onChange={(e) => setUploadFileType(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#fff' }}
                  >
                    <option value="pdf">PDF (.pdf)</option>
                    <option value="docx">Word (.docx)</option>
                    <option value="zip">Archive (.zip)</option>
                    <option value="link">Cloud Link (URL)</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                  File Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CS101_Midterm_Solutions.pdf"
                  value={uploadFileName}
                  onChange={(e) => setUploadFileName(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                  File URL or Link *
                </label>
                <input
                  type="text"
                  required
                  placeholder="https://drive.google.com/... or /uploads/sample.pdf"
                  value={uploadFileUrl}
                  onChange={(e) => setUploadFileUrl(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="midterm, exam, graphs, solutions"
                  value={uploadTags}
                  onChange={(e) => setUploadTags(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                  Description / Study Tips (Optional)
                </label>
                <textarea
                  rows="3"
                  placeholder="Add tips or details about this material..."
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>

              {/* Anonymity Toggle */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 12px',
                  backgroundColor: '#f9fafb',
                  borderRadius: '6px',
                  marginBottom: '18px',
                }}
              >
                <input
                  type="checkbox"
                  id="resource-anon-toggle"
                  checked={uploadAnonymous}
                  onChange={(e) => setUploadAnonymous(e.target.checked)}
                  style={{ cursor: 'pointer' }}
                />
                <label
                  htmlFor="resource-anon-toggle"
                  style={{ fontSize: '13px', cursor: 'pointer', margin: 0 }}
                >
                  <span style={{ fontWeight: 600 }}>Share anonymously</span>
                  <span style={{ display: 'block', fontSize: '11px', color: '#6b7280' }}>
                    Your username will be masked with a pseudonym alias.
                  </span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #dcdcdc',
                    background: '#fff',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: '8px 18px',
                    backgroundColor: '#1d4ed8',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    fontWeight: 600,
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isSubmitting ? 'Publishing...' : 'Publish Material'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResourceLibraryPage;
