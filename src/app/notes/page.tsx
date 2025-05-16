'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';
import { FiLogOut, FiPlus, FiX, FiFileText, FiTrash2, FiEdit } from 'react-icons/fi';
import { getDatabase, ref, onValue, push, update, remove, DataSnapshot } from 'firebase/database';
import { toast } from 'react-hot-toast';

interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
  userId: string;
  contentLength?: number;
}

function NotesPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const db = getDatabase();

  const [notes, setNotes] = useState<Note[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'longest' | 'shortest'>('newest');
  const [currentNote, setCurrentNote] = useState<Partial<Note>>({
    id: '',
    title: '',
    content: ''
  });
  const [originalNote, setOriginalNote] = useState<Partial<Note>>({
    id: '',
    title: '',
    content: ''
  });

  const isFormValid = currentNote.title?.trim() !== '' && currentNote.content?.trim() !== '';

  // Fetch notes from Firebase Realtime Database
  useEffect(() => {
    if (!user) return;

    const notesRef = ref(db, 'notes');

    const unsubscribe = onValue(notesRef, (snapshot) => {
      const notesData = snapshot.val() || {};
      let loadedNotes = Object.entries(notesData)
        .map(([id, note]: [string, any]) => ({
          id,
          ...note,
          contentLength: note.content?.length || 0
        }))
        .filter(note => note.userId === user.uid);

      // Apply sorting based on selected option
      switch (sortBy) {
        case 'newest':
          loadedNotes.sort((a, b) => b.updatedAt - a.updatedAt);
          break;
        case 'oldest':
          loadedNotes.sort((a, b) => a.updatedAt - b.updatedAt);
          break;
        case 'longest':
          loadedNotes.sort((a, b) => b.contentLength - a.contentLength);
          break;
        case 'shortest':
          loadedNotes.sort((a, b) => a.contentLength - b.contentLength);
          break;
        default:
          loadedNotes.sort((a, b) => b.updatedAt - a.updatedAt);
      }
      setNotes(loadedNotes);
      setIsLoading(false);
    }, (error) => {
      console.error('Error fetching notes:', error);
      toast.error('Failed to load notes');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user, db, sortBy]);

  const handleCreateNote = async () => {
    if (!user) return;

    try {
      const newNoteRef = push(ref(db, 'notes'));
      
      const newNote = {
        id: newNoteRef.key,
        title: currentNote.title?.trim() || 'Untitled Note',
        content: currentNote.content?.trim() || '',
        userId: user.uid,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await update(ref(db, 'notes'), { [newNoteRef.key]: newNote });
      setIsModalOpen(false);
      setCurrentNote({ id: '', title: '', content: '' });
      setOriginalNote({ id: '', title: '', content: '' });
      toast.success('Note created successfully!');
    } catch (error: any) {
      console.error('Error creating note:', error);
      toast.error(error.message || 'Failed to create note');
    }
  };

  const handleUpdateNote = async () => {
    if (!user || !currentNote.id || !hasChanges()) return;

    try {
      await update(ref(db, `notes/${currentNote.id}`), {
        title: currentNote.title?.trim() || 'Untitled Note',
        content: currentNote.content?.trim() || '',
        updatedAt: Date.now()
      });
      
      setIsModalOpen(false);
      setCurrentNote({ id: '', title: '', content: '' });
      setOriginalNote({ id: '', title: '', content: '' });
      toast.success('Note updated successfully!');
    } catch (error: any) {
      console.error('Error updating note:', error);
      toast.error('Failed to update note');
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!window.confirm('Are you sure you want to delete this note?')) return;

    try {
      const noteRef = ref(db, `notes/${noteId}`);
      await remove(noteRef);
      toast.success('Note deleted successfully!');
    } catch (error: any) {
      console.error('Error deleting note:', error);
      toast.error(error.message || 'Failed to delete note');
    }
  };

  const handleEditNote = (note: Note) => {
    const noteToEdit = {
      id: note.id,
      title: note.title,
      content: note.content
    };
    setCurrentNote(noteToEdit);
    setOriginalNote({ ...noteToEdit });
    setIsEditing(true);
    setIsModalOpen(true);
  };

  const hasChanges = () => {
    return currentNote.title !== originalNote.title || currentNote.content !== originalNote.content;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setCurrentNote(prev => ({
      ...(prev || {}),
      [name]: value
    }));
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setIsEditing(false);
    setCurrentNote({ id: '', title: '', content: '' });
    setOriginalNote({ id: '', title: '', content: '' });
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <ProtectedRoute>
        <nav className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <h1 className="text-xl font-bold text-gray-900">Notes App</h1>
              </div>

              <div className="flex items-center space-x-4">
                {user?.email && (
                  <div className="hidden md:flex items-center text-sm text-gray-700">
                    {user.email}
                  </div>
                )}

                <div className="flex items-center space-x-2">
                  <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
                    {user?.email?.[0]?.toUpperCase() || 'U'}
                  </div>

                  <button
                    onClick={handleLogout}
                    className="p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    title="Sign out"
                  >
                    <FiLogOut className="h-5 w-5" />
                    <span className="sr-only">Sign out</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </nav>

        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="mb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h2 className="text-lg font-medium text-gray-900">My Notes</h2>
              <div className="w-full sm:w-auto flex flex-col sm:flex-row gap-3">
                <div className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="block w-full pl-3 pr-10 py-2 text-base border border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md text-gray-900"
                  >
                    <option value="newest" className="text-gray-900">Sort by: Newest first</option>
                    <option value="oldest" className="text-gray-900">Sort by: Oldest first</option>
                    <option value="longest" className="text-gray-900">Sort by: Longest content</option>
                    <option value="shortest" className="text-gray-900">Sort by: Shortest content</option>
                  </select>
                </div>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <FiPlus className="-ml-1 mr-2 h-5 w-5" />
                  New Note
                </button>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            ) : notes.length === 0 ? (
              <div className="border-4 border-dashed border-gray-200 rounded-lg p-8 text-center h-96 flex flex-col items-center justify-center">
                <FiFileText className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No notes yet</h3>
                <p className="mt-1 text-sm text-gray-500">Get started by creating a new note.</p>
                <div className="mt-6">
                  <button
                    onClick={() => setIsModalOpen(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <FiPlus className="-ml-1 mr-2 h-5 w-5" />
                    New Note
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {notes.map((note) => (
                  <div 
                    key={note.id} 
                    className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-all duration-200 flex flex-col h-full cursor-pointer hover:ring-2 hover:ring-blue-500"
                    onClick={() => handleEditNote(note)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && handleEditNote(note)}
                  >
                    <div className="p-5 flex-1">
                      <div className="h-full">
                        <div className="flex-1 min-w-0 flex flex-col h-full">
                          <div>
                            <h3 className="text-lg font-medium text-black truncate">
                              {note.title || 'Untitled Note'}
                            </h3>
                            <p className="mt-1 text-sm text-black line-clamp-6 whitespace-pre-wrap">
                              {note.content}
                            </p>
                          </div>
                          <div className="mt-auto pt-4">
                            <div className="flex justify-between items-center border-t border-gray-200 pt-2">
                              <p className="text-xs text-gray-500">
                                Last edited: {new Date(note.updatedAt).toLocaleString('en-GB', {
                                  day: '2-digit',
                                  month: '2-digit',
                                  year: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: true
                                })}
                              </p>
                              <div className="flex space-x-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEditNote(note);
                                  }}
                                  className="p-1 text-gray-400 hover:text-blue-500 focus:outline-none"
                                  title="Edit note"
                                >
                                  <FiEdit className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteNote(note.id);
                                  }}
                                  className="p-1 text-gray-400 hover:text-red-500 focus:outline-none"
                                  title="Delete note"
                                >
                                  <FiTrash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Create Note Modal */}
            {isModalOpen && (
              <div className="fixed z-10 inset-0 overflow-y-auto">
                <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
                  <div className="fixed inset-0 transition-opacity" aria-hidden="true">
                    <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
                  </div>
                  <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">
                    &#8203;
                  </span>
                  <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                      <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                        <h3 className="text-lg font-medium text-black">
                          {isEditing ? 'Edit Note' : 'New Note'}
                        </h3>
                        <button
                          onClick={handleModalClose}
                          className="text-gray-400 hover:text-gray-500 focus:outline-none"
                        >
                          <FiX className="h-6 w-6" />
                        </button>
                      </div>
                      <div className="p-6 flex-1 overflow-y-auto">
                        <div className="space-y-4">
                          <div>
                            <label htmlFor="title" className="block text-sm font-medium text-black mb-1">
                              Title
                            </label>
                            <input
                              type="text"
                              id="title"
                              value={currentNote.title || ''}
                              onChange={(e) => setCurrentNote({ ...currentNote, title: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-black"
                              placeholder="Note title"
                            />
                          </div>
                          <div className="flex-1">
                            <label htmlFor="content" className="block text-sm font-medium text-black mb-1">
                              Content
                            </label>
                            <textarea
                              id="content"
                              rows={10}
                              value={currentNote.content || ''}
                              onChange={(e) => setCurrentNote({ ...currentNote, content: e.target.value })}
                              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 whitespace-pre-wrap text-black"
                              placeholder="Write your note here..."
                            />
                          </div>
                        </div>
                      </div>
                      <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
                        <button
                          type="button"
                          onClick={() => {
                            setIsModalOpen(false);
                            setCurrentNote({ id: '', title: '', content: '' });
                            setOriginalNote({ id: '', title: '', content: '' });
                            setIsEditing(false);
                          }}
                          className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={isEditing ? handleUpdateNote : handleCreateNote}
                          disabled={!isFormValid || (isEditing && !hasChanges())}
                          className={`px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                            isFormValid && (!isEditing || hasChanges())
                              ? 'bg-blue-600 hover:bg-blue-700'
                              : 'bg-blue-300 cursor-not-allowed'
                          } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
                        >
                          {isEditing ? 'Update' : 'Create'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </ProtectedRoute>
    </div>
  );
}

export default NotesPage;
