import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, ScrollView, TouchableOpacity, Modal, StatusBar } from 'react-native';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware'; 
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import * as Speech from 'expo-speech';
import hymnData from './assets/fullsongs.json';

// ==========================================================
// GLOBAL STATE MANAGER (STORES PREFERENCES & SERMON NOTES OFF-LINE)
// ==========================================================
const useHymnStore = create(
  persist(
    (set) => ({
      favorites: [],
      fontSize: 18,
      theme: 'dark',
      notes: [], 
      
      toggleFavorite: (id) => set((state) => ({
        favorites: state.favorites.includes(id)
          ? state.favorites.filter((favId) => favId !== id)
          : [...state.favorites, id]
      })),
      
      setFontSize: (size) => set({ fontSize: size }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      
      // Note Subsystem Actions
      addNote: (newNote) => set((state) => ({ notes: [newNote, ...state.notes] })),
      updateNote: (updatedNote) => set((state) => ({
        notes: state.notes.map((n) => n.id === updatedNote.id ? updatedNote : n)
      })),
      deleteNote: (id) => set((state) => ({ notes: state.notes.filter((n) => n.id !== id) }))
    }),
    {
      name: 'only-believe-hymns-storage', 
      storage: createJSONStorage(() => AsyncStorage), 
    }
  )
);

export default function App() {
  const [activeTab, setActiveTab] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedHymn, setSelectedHymn] = useState(null);
  const [isSpeaking, setIsSpeaking] = useState(false); 
  const [isHydrated, setIsHydrated] = useState(false); 

  // Sermon Form UI states
  const [noteSearchQuery, setNoteSearchQuery] = useState('');
  const [isNoteFormModalOpen, setIsNoteFormModalOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null); // null means "Create mode", string means "Edit mode"
  const [selectedNote, setSelectedNote] = useState(null);
  
  // Note Input States
  const [noteDate, setNoteDate] = useState('');
  const [notePreacher, setNotePreacher] = useState('');
  const [noteTopic, setNoteTopic] = useState('');
  const [noteScriptures, setNoteScriptures] = useState('');
  const [noteBody, setNoteBody] = useState('');

  const { favorites, toggleFavorite, fontSize, setFontSize, theme, toggleTheme, notes, addNote, updateNote, deleteNote } = useHymnStore();

  useEffect(() => {
    const unsubHydrate = useHymnStore.persist.onHydrate(() => setIsHydrated(false));
    const unsubFinish = useHymnStore.persist.onFinishHydration(() => setIsHydrated(true));

    if (useHymnStore.persist.hasHydrated()) {
      setIsHydrated(true);
    }

    return () => {
      unsubHydrate();
      unsubFinish();
    };
  }, []);

  useEffect(() => {
    setSearchQuery('');
    setNoteSearchQuery('');
    stopSpeechEngine(); 
  }, [activeTab]);

  const handleCloseModal = () => {
    stopSpeechEngine();
    setSelectedHymn(null);
  };

  const stopSpeechEngine = () => {
    Speech.stop();
    setIsSpeaking(false);
  };

  // Open form for an entirely fresh note
  const openNewNoteModal = () => {
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    setEditingNoteId(null);
    setNoteDate(today);
    setNotePreacher('');
    setNoteTopic('');
    setNoteScriptures('');
    setNoteBody('');
    setIsNoteFormModalOpen(true);
  };

  // Open form using data from an existing saved note
  const openEditNoteModal = (note) => {
    setEditingNoteId(note.id);
    setNoteDate(note.date);
    setNotePreacher(note.preacher);
    setNoteTopic(note.topic);
    setNoteScriptures(note.scriptures);
    setNoteBody(note.body);
    setSelectedNote(null); // Close the view modal
    setIsNoteFormModalOpen(true);
  };

  const handleSaveNote = () => {
    if (!noteTopic.trim() || !noteBody.trim()) {
      alert("Please provide at least a Topic and Message contents for your note.");
      return;
    }

    const targetNoteData = {
      id: editingNoteId || Date.now().toString(),
      date: noteDate.trim(),
      preacher: notePreacher.trim() || 'Unknown Preacher',
      topic: noteTopic.trim(),
      scriptures: noteScriptures.trim() || 'None Specified',
      body: noteBody.trim()
    };

    if (editingNoteId) {
      updateNote(targetNoteData);
    } else {
      addNote(targetNoteData);
    }
    
    setIsNoteFormModalOpen(false);
  };

  // TTS Voice Engine
  const handleTextToSpeech = (hymn) => {
    if (isSpeaking) {
      stopSpeechEngine();
      return;
    }
    let textToRead = `${hymn.title}... \n\n`;
    hymn.chapters.forEach((chap) => {
      const isChorus = chap.chapter && chap.chapter.toString().toLowerCase() === 'chorus';
      textToRead += isChorus ? 'Chorus... \n' : `Stanza ${chap.chapter}... \n`;
      if (chap.verses) {
        chap.verses.forEach((line) => {
          textToRead += `${line.trim().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]$/, "")}... \n`;
        });
        textToRead += `... \n`;
      }
    });

    setIsSpeaking(true);
    Speech.speak(textToRead, {
      language: 'en', pitch: 0.98, rate: 0.78,
      onDone: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false)
    });
  };

  // Hymn Filter
  const displayHymns = hymnData.hymns.filter(hymn => {
    if (activeTab === 'favorites' && !favorites.includes(hymn.id)) return false;
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      (hymn.id && hymn.id.toString().includes(query)) ||
      (hymn.title && hymn.title.toLowerCase().includes(query)) ||
      (hymn.chapters && hymn.chapters.some(chap => chap.verses && chap.verses.some(line => line.toLowerCase().includes(query))))
    );
  });

  // Notes Search Filter
  const filteredNotes = notes.filter(note => {
    const query = noteSearchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      note.topic.toLowerCase().includes(query) ||
      note.preacher.toLowerCase().includes(query) ||
      note.scriptures.toLowerCase().includes(query) ||
      note.body.toLowerCase().includes(query)
    );
  });

  if (!isHydrated) {
    return (
      <View style={[styles.appWrapper, styles.centerFlex, { backgroundColor: theme === 'dark' ? '#030712' : '#f8fafc' }]}>
        <Text style={{ color: theme === 'dark' ? '#f59e0b' : '#047857', fontSize: 16, fontWeight: '600' }}>Opening Hymnals...</Text>
      </View>
    );
  }

  const isDark = theme === 'dark';
  const themeBg = isDark ? styles.bgDark : styles.bgLight;
  const themeText = isDark ? styles.textDark : styles.textLight;
  const themeCard = isDark ? styles.cardDark : styles.cardLight;
  const themeBorder = isDark ? styles.borderDark : styles.borderLight;
  const themeHeader = isDark ? styles.headerDark : styles.headerLight;

  return (
    <View style={[styles.appWrapper, themeBg]}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={isDark ? "#0b132b" : "#047857"} />
      
      {/* HEADER TITLE */}
      <View style={[styles.header, themeHeader]}>
        <Text style={isDark ? styles.headerSubtitleDark : styles.headerSubtitleLight}>ONLY BELIEVE</Text>
        <Text style={styles.headerTitle}>
          {activeTab === 'notes' ? 'Sermon Notes' : 'Hymns'}
        </Text>
      </View>

      <View style={styles.mainContent}>
        
        {/* VIEWPORT: HYMNS LIST & FAVORITES */}
        {(activeTab === 'all' || activeTab === 'favorites') && (
          <View style={styles.viewport}>
            <View style={[styles.searchWrapper, isDark ? styles.searchDark : styles.searchLight, themeBorder]}>
              <Text style={styles.searchIconInline}>🔍</Text>
              <TextInput 
                style={[styles.searchBar, { color: isDark ? '#f8fafc' : '#1e293b' }]}
                placeholder={activeTab === 'favorites' ? "Search favorite hymns..." : "Search number, title, words..."}
                placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>
            <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
              {displayHymns.map((item) => {
                const isFav = favorites.includes(item.id);
                return (
                  <TouchableOpacity key={item.id} style={[styles.card, themeCard, themeBorder]} onPress={() => setSelectedHymn(item)}>
                    <View style={styles.cardRow}>
                      <View style={[styles.numberContainer, isDark ? styles.numDark : styles.numLight, themeBorder]}>
                        <Text style={[styles.numberBadge, { color: isDark ? '#f59e0b' : '#047857' }]}>{item.id}</Text>
                      </View>
                      <View style={styles.cardInfoBlock}>
                        <Text style={[styles.cardText, themeText]} numberOfLines={1}>{item.title}</Text>
                        <Text style={styles.subText}>{item.piano ? `🎹 Key: ${item.piano}` : 'Hymn Matrix'}</Text>
                      </View>
                      <TouchableOpacity onPress={() => toggleFavorite(item.id)} style={styles.inlineFavTouch}>
                        <Text style={[styles.heartIcon, { color: isDark ? '#f59e0b' : '#047857' }]}>{isFav ? '★' : '☆'}</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* VIEWPORT: SERMON NOTES NOTEBOOK */}
        {activeTab === 'notes' && (
          <View style={styles.viewport}>
            <View style={styles.notesActionsHeader}>
              <View style={[styles.searchWrapper, isDark ? styles.searchDark : styles.searchLight, themeBorder, { flex: 1, marginBottom: 0 }]}>
                <Text style={styles.searchIconInline}>🔍</Text>
                <TextInput 
                  style={[styles.searchBar, { color: isDark ? '#f8fafc' : '#1e293b' }]}
                  placeholder="Search sermon details..."
                  placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                  value={noteSearchQuery}
                  onChangeText={setNoteSearchQuery}
                />
              </View>
              <TouchableOpacity style={[styles.addButton, { backgroundColor: isDark ? '#f59e0b' : '#047857' }]} onPress={openNewNoteModal}>
                <Text style={styles.addButtonText}>＋ New</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: 12 }}>
              {filteredNotes.length === 0 ? (
                <View style={[styles.centerFlex, { marginTop: 40 }]}>
                  <Text style={{ color: '#64748b', fontSize: 15 }}>No sermon records found.</Text>
                </View>
              ) : (
                filteredNotes.map((note) => (
                  <TouchableOpacity key={note.id} style={[styles.card, themeCard, themeBorder]} onPress={() => setSelectedNote(note)}>
                    <Text style={styles.noteCardDate}>{note.date}</Text>
                    <Text style={[styles.noteCardTopic, themeText]} numberOfLines={1}>{note.topic}</Text>
                    <Text style={styles.noteCardPreacher} numberOfLines={1}>👤 {note.preacher}</Text>
                    <Text style={styles.noteCardScripture} numberOfLines={1}>📖 {note.scriptures}</Text>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        )}

        {/* VIEWPORT: SETTINGS MODULE */}
        {activeTab === 'settings' && (
          <ScrollView style={styles.viewport} showsVerticalScrollIndicator={false}>
            <Text style={[styles.sectionTitle, themeText]}>Display Settings</Text>
            <View style={[styles.settingCard, themeCard, themeBorder]}>
              <View style={styles.settingMetaText}>
                <Text style={[styles.settingLabel, themeText]}>Application Theme</Text>
                <Text style={styles.settingSubLabel}>Currently: {isDark ? 'Midnight Gold' : 'Pure Light'}</Text>
              </View>
              <TouchableOpacity style={[styles.themeToggleButton, { backgroundColor: isDark ? '#f59e0b' : '#047857' }]} onPress={toggleTheme}>
                <Text style={styles.themeToggleBtnText}>{isDark ? '☀️ Light' : '🌙 Dark'}</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.settingCard, themeCard, themeBorder]}>
              <View style={styles.settingMetaText}>
                <Text style={[styles.settingLabel, themeText]}>Reader Text Size</Text>
                <Text style={styles.settingSubLabel}>Adjust lyrics spacing layout</Text>
              </View>
              <View style={[styles.buttonRow, { backgroundColor: isDark ? '#1e293b' : '#e2e8f0' }]}>
                <TouchableOpacity style={[styles.sizeButton, { backgroundColor: isDark ? '#334155' : '#cbd5e1' }]} onPress={() => setFontSize(Math.max(14, fontSize - 2))}>
                  <Text style={{ color: isDark ? '#f8fafc' : '#1e293b', fontWeight: 'bold' }}>A-</Text>
                </TouchableOpacity>
                <View style={styles.sizeIndicatorValue}>
                  <Text style={{ color: isDark ? '#f59e0b' : '#047857', fontWeight: 'bold' }}>{fontSize}</Text>
                </View>
                <TouchableOpacity style={[styles.sizeButton, { backgroundColor: isDark ? '#334155' : '#cbd5e1' }]} onPress={() => setFontSize(Math.min(32, fontSize + 2))}>
                  <Text style={{ color: isDark ? '#f8fafc' : '#1e293b', fontWeight: 'bold' }}>A+</Text>
                </TouchableOpacity>
              </View>
            </View>

            <Text style={[styles.sectionTitle, themeText, { marginTop: 12 }]}>About</Text>
            <View style={[styles.aboutSurface, themeCard, themeBorder]}>
              <Text style={[styles.aboutAppTitle, themeText]}>Only Believe Hymn</Text>
              <Text style={styles.aboutAppVersion}>Version 2.0.0</Text>
              <View style={[styles.luxuryDivider, { backgroundColor: isDark ? '#1e293b' : '#e2e8f0', marginVertical: 12 }]} />
              <Text style={[styles.aboutDescriptionText, { color: isDark ? '#94a3b8' : '#475569' }]}>
                This Only Believe Hymn is dedicated to the Brides of Christ World Wide. 
                
                For more updates and support, you can contact the Pastor, Ilorin Christian Assembl on 08033797183, Bro Mayowa on 07030577951 or 
                email us : ilorinchristianassembly@gmail.com
              </Text>
            </View>
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </View>

      {/* CORE FOUR-BAR TAB NAVIGATION */}
      <View style={[styles.tabBar, { backgroundColor: isDark ? '#0b132b' : '#ffffff', borderTopColor: isDark ? '#1e293b' : '#e2e8f0' }]}>
        <TouchableOpacity style={[styles.tabItem, activeTab === 'all' && (isDark ? styles.activeTabDark : styles.activeTabLight)]} onPress={() => setActiveTab('all')}>
          <Text style={[styles.tabIcon, activeTab === 'all' && styles.opacityFull]}>🎶</Text>
          <Text style={[styles.tabLabel, activeTab === 'all' && { color: isDark ? '#f59e0b' : '#047857', fontWeight: 'bold' }]}>Hymns</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabItem, activeTab === 'favorites' && (isDark ? styles.activeTabDark : styles.activeTabLight)]} onPress={() => setActiveTab('favorites')}>
          <Text style={[styles.tabIcon, activeTab === 'favorites' && styles.opacityFull]}>⭐</Text>
          <Text style={[styles.tabLabel, activeTab === 'favorites' && { color: isDark ? '#f59e0b' : '#047857', fontWeight: 'bold' }]}>Saved</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabItem, activeTab === 'notes' && (isDark ? styles.activeTabDark : styles.activeTabLight)]} onPress={() => setActiveTab('notes')}>
          <Text style={[styles.tabIcon, activeTab === 'notes' && styles.opacityFull]}>📝</Text>
          <Text style={[styles.tabLabel, activeTab === 'notes' && { color: isDark ? '#f59e0b' : '#047857', fontWeight: 'bold' }]}>Notes</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabItem, activeTab === 'settings' && (isDark ? styles.activeTabDark : styles.activeTabLight)]} onPress={() => setActiveTab('settings')}>
          <Text style={[styles.tabIcon, activeTab === 'settings' && styles.opacityFull]}>⚙️</Text>
          <Text style={[styles.tabLabel, activeTab === 'settings' && { color: isDark ? '#f59e0b' : '#047857', fontWeight: 'bold' }]}>Settings</Text>
        </TouchableOpacity>
      </View>

      {/* MODAL: HYMN DISPLAY */}
      <Modal visible={selectedHymn !== null} animationType="slide" onRequestClose={handleCloseModal}>
        {selectedHymn && (
          <View style={[styles.modalContainer, themeBg]}>
            <View style={[styles.modalHeader, { backgroundColor: isDark ? '#0b132b' : '#047857', borderBottomColor: isDark ? '#1e293b' : '#046a4e' }]}>
              <TouchableOpacity onPress={handleCloseModal} style={styles.closeButton}><Text style={{ color: '#fff', fontWeight: '600' }}>✕ Close</Text></TouchableOpacity>
              <Text style={styles.modalHeaderTitle}>Hymn {selectedHymn.id}</Text>
              <TouchableOpacity onPress={() => toggleFavorite(selectedHymn.id)} style={styles.modalFavButton}><Text style={{ color: '#fff', fontWeight: 'bold' }}>{favorites.includes(selectedHymn.id) ? '★ Saved' : '☆ Save'}</Text></TouchableOpacity>
            </View>
            <View style={[styles.audioDock, { backgroundColor: isDark ? '#0f172a' : '#f1f5f9', borderBottomColor: isDark ? '#1e293b' : '#e2e8f0' }]}>
              <View style={styles.audioDockFlexRow}>
                <TouchableOpacity style={[styles.audioIconBtn, isSpeaking ? styles.audioIconBtnStop : styles.audioIconBtnPlay]} onPress={() => handleTextToSpeech(selectedHymn)}>
                  <Text style={styles.audioIconText}>{isSpeaking ? '⏹️' : '🔊'}</Text>
                </TouchableOpacity>
                <Text style={styles.audioStatusText}>{isSpeaking ? "Narrating lyrics..." : "Tap to hear text reading"}</Text>
              </View>
            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              <Text style={[styles.hymnMainTitle, themeText]}>{selectedHymn.title}</Text>
              {selectedHymn.chapters && selectedHymn.chapters.map((chap, idx) => {
                const isChorus = chap.chapter && chap.chapter.toString().toLowerCase() === 'chorus';
                return (
                  <View key={idx} style={[styles.chapterBlock, isChorus && (isDark ? styles.chorusBlockDark : styles.chorusBlockLight)]}>
                    <Text style={styles.chapterLabel}>{isChorus ? 'CHORUS' : `STANZA ${chap.chapter}`}</Text>
                    {chap.verses && chap.verses.map((line, lIdx) => (
                      <Text key={lIdx} style={[styles.lyricLine, { fontSize, lineHeight: fontSize + 10 }, isChorus ? (isDark ? styles.chorusTextDark : styles.chorusTextLight) : themeText]}>{line}</Text>
                    ))}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}
      </Modal>

      {/* MODAL: WRITE / EDIT SERMON NOTE FORM */}
      <Modal visible={isNoteFormModalOpen} animationType="slide" transparent={false}>
        <View style={[styles.modalContainer, themeBg]}>
          <View style={[styles.modalHeader, { backgroundColor: isDark ? '#0b132b' : '#047857' }]}>
            <TouchableOpacity onPress={() => setIsNoteFormModalOpen(false)} style={styles.closeButton}><Text style={{ color: '#fff' }}>Cancel</Text></TouchableOpacity>
            <Text style={styles.modalHeaderTitle}>{editingNoteId ? 'Edit Message' : 'Record Sermon'}</Text>
            <TouchableOpacity onPress={handleSaveNote} style={styles.modalFavButton}><Text style={{ color: '#fff', fontWeight: 'bold' }}>Save</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.formContainer} showsVerticalScrollIndicator={false}>
            <Text style={[styles.formLabel, themeText]}>Date</Text>
            <TextInput style={[styles.formInput, themeCard, themeText, themeBorder]} value={noteDate} onChangeText={setNoteDate} placeholder="e.g., June 28, 2026" placeholderTextColor="#64748b" />
            
            <Text style={[styles.formLabel, themeText]}>Preacher Name</Text>
            <TextInput style={[styles.formInput, themeCard, themeText, themeBorder]} value={notePreacher} onChangeText={setNotePreacher} placeholder="Who is speaking?" placeholderTextColor="#64748b" />
            
            <Text style={[styles.formLabel, themeText]}>Sermon Topic / Title</Text>
            <TextInput style={[styles.formInput, themeCard, themeText, themeBorder]} value={noteTopic} onChangeText={setNoteTopic} placeholder="What is the main theme?" placeholderTextColor="#64748b" />
            
            <Text style={[styles.formLabel, themeText]}>Scripture Reading(s)</Text>
            <TextInput style={[styles.formInput, themeCard, themeText, themeBorder]} value={noteScriptures} onChangeText={setNoteScriptures} placeholder="e.g., Genesis 1:1-5, John 3:16" placeholderTextColor="#64748b" />
            
            <Text style={[styles.formLabel, themeText]}>Messages / Sermon Body</Text>
            <TextInput style={[styles.formInput, styles.formTextarea, themeCard, themeText, themeBorder]} value={noteBody} onChangeText={setNoteBody} placeholder="Type your sermon notes here... Appends safely live as words flow." placeholderTextColor="#64748b" multiline={true} numberOfLines={14} textAlignVertical="top" />
          </ScrollView>
        </View>
      </Modal>

      {/* MODAL: READ SAVED SERMON NOTE */}
      <Modal visible={selectedNote !== null} animationType="fade" transparent={false}>
        {selectedNote && (
          <View style={[styles.modalContainer, themeBg]}>
            <View style={[styles.modalHeader, { backgroundColor: isDark ? '#0b132b' : '#047857' }]}>
              <TouchableOpacity onPress={() => setSelectedNote(null)} style={styles.closeButton}><Text style={{ color: '#fff' }}>✕ Back</Text></TouchableOpacity>
              
              {/* EDIT TRIGGER ATTACHED DIRECTLY ON THE TOP BAR PANEL */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity onPress={() => openEditNoteModal(selectedNote)} style={[styles.closeButton, { backgroundColor: '#f59e0b' }]}><Text style={{ color: '#1e293b', fontWeight: 'bold' }}>✏️ Edit</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => { deleteNote(selectedNote.id); setSelectedNote(null); }} style={[styles.closeButton, { backgroundColor: '#ef4444' }]}><Text style={{ color: '#fff', fontWeight: 'bold' }}>Delete</Text></TouchableOpacity>
              </View>

            </View>
            <ScrollView contentContainerStyle={styles.modalBody}>
              <Text style={styles.noteViewDate}>{selectedNote.date}</Text>
              <Text style={[styles.noteViewTopic, themeText]}>{selectedNote.topic}</Text>
              
              <View style={[styles.noteMetaRow, themeCard, themeBorder]}>
                <Text style={themeText}><Text style={{ fontWeight: 'bold', color: '#64748b' }}>Preacher: </Text>{selectedNote.preacher}</Text>
                <Text style={[themeText, { marginTop: 4 }]}><Text style={{ fontWeight: 'bold', color: '#64748b' }}>Scriptures: </Text>{selectedNote.scriptures}</Text>
              </View>

              <View style={[styles.luxuryDivider, { backgroundColor: isDark ? '#1e293b' : '#e2e8f0' }]} />
              <Text style={[styles.noteViewBody, themeText, { fontSize: fontSize }]}>{selectedNote.body}</Text>
            </ScrollView>
          </View>
        )}
      </Modal>

    </View>
  );
}

// ==========================================================
// SYSTEM STYLES DESIGN GRAPH
// ==========================================================
const styles = StyleSheet.create({
  appWrapper: { flex: 1 },
  centerFlex: { justifyContent: 'center', alignItems: 'center' },
  bgDark: { backgroundColor: '#030712' },
  bgLight: { backgroundColor: '#f8fafc' },
  textDark: { color: '#f1f5f9' },
  textLight: { color: '#1e293b' },
  cardDark: { backgroundColor: '#0f172a' },
  cardLight: { backgroundColor: '#ffffff' },
  borderDark: { borderColor: '#1e293b' },
  borderLight: { borderColor: '#e2e8f0' },
  headerDark: { backgroundColor: '#0b132b', borderBottomColor: '#1e293b' },
  headerLight: { backgroundColor: '#047857', borderBottomColor: '#046a4e' },
  headerSubtitleDark: { color: '#d97706', fontSize: 11, fontWeight: '800', letterSpacing: 3, marginBottom: 2 },
  headerSubtitleLight: { color: '#f59e0b', fontSize: 11, fontWeight: '800', letterSpacing: 3, marginBottom: 2 },
  header: { paddingTop: 24, paddingBottom: 20, alignItems: 'center', borderBottomWidth: 1 },
  headerTitle: { color: '#f8fafc', fontSize: 24, fontWeight: 'bold' },
  mainContent: { flex: 1, width: '100%', maxWidth: 540, marginHorizontal: 'auto' },
  viewport: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  
  searchWrapper: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, marginBottom: 16, height: 52 },
  searchDark: { backgroundColor: '#1e293b' },
  searchLight: { backgroundColor: '#ffffff' },
  searchIconInline: { fontSize: 16, marginRight: 8, opacity: 0.5 },
  searchBar: { flex: 1, fontSize: 16, height: '100%' },
  
  listContainer: { flex: 1 },
  card: { padding: 16, borderRadius: 12, marginVertical: 6, borderWidth: 1 },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  numberContainer: { width: 44, height: 44, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 14, borderWidth: 1 },
  numDark: { backgroundColor: '#1e293b' },
  numLight: { backgroundColor: '#f1f5f9' },
  numberBadge: { fontWeight: 'bold', fontSize: 16 },
  cardInfoBlock: { flex: 1 },
  cardText: { fontSize: 17, fontWeight: '600' },
  subText: { fontSize: 13, color: '#64748b', marginTop: 2 },
  inlineFavTouch: { paddingHorizontal: 4 },
  heartIcon: { fontSize: 22 },

  // Sermon List Sub-Styles
  notesActionsHeader: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 6 },
  addButton: { height: 52, paddingHorizontal: 20, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  addButtonText: { color: '#ffffff', fontWeight: 'bold', fontSize: 16 },
  noteCardDate: { fontSize: 12, color: '#64748b', fontWeight: '600', marginBottom: 4 },
  noteCardTopic: { fontSize: 18, fontWeight: 'bold', marginBottom: 6 },
  noteCardPreacher: { fontSize: 14, color: '#64748b', marginBottom: 2 },
  noteCardScripture: { fontSize: 14, color: '#64748b' },
  
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16, marginTop: 4 },
  settingCard: { padding: 16, borderRadius: 12, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  settingMetaText: { flex: 1 },
  settingLabel: { fontSize: 16, fontWeight: '600' },
  settingSubLabel: { fontSize: 12, color: '#64748b', marginTop: 2 },
  themeToggleButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  themeToggleBtnText: { color: '#fff', fontWeight: 'bold' },
  buttonRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 8, padding: 4 },
  sizeButton: { width: 36, height: 36, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  sizeIndicatorValue: { paddingHorizontal: 12 },
  
  aboutSurface: { padding: 20, borderRadius: 12, borderWidth: 1 },
  aboutAppTitle: { fontSize: 18, fontWeight: 'bold' },
  aboutAppVersion: { fontSize: 13, color: '#64748b', marginTop: 2 },
  aboutDescriptionText: { fontSize: 14, lineHeight: 22 },
  
  tabBar: { flexDirection: 'row', height: 72, borderTopWidth: 1 },
  tabItem: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  activeTabDark: { borderTopWidth: 3, borderTopColor: '#f59e0b', marginTop: -3 },
  activeTabLight: { borderTopWidth: 3, borderTopColor: '#047857', marginTop: -3 },
  tabIcon: { fontSize: 20, marginBottom: 3, opacity: 0.4 },
  opacityFull: { opacity: 1 },
  tabLabel: { fontSize: 12 },
  
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: 'transparent' },
  closeButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, backgroundColor: 'rgba(255,255,255,0.15)' },
  modalHeaderTitle: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  modalFavButton: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, backgroundColor: '#f59e0b' },
  
  audioDock: { padding: 12, borderBottomWidth: 1 },
  audioDockFlexRow: { flexDirection: 'row', alignItems: 'center', gap: 12, maxWidth: 540, width: '100%', marginHorizontal: 'auto' },
  audioIconBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  audioIconBtnPlay: { backgroundColor: '#10b981' },
  audioIconBtnStop: { backgroundColor: '#ef4444' },
  audioIconText: { fontSize: 16 },
  audioStatusText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  
  modalBody: { paddingHorizontal: 24, paddingVertical: 24, maxWidth: 540, marginHorizontal: 'auto', width: '100%' },
  hymnMainTitle: { fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  luxuryDivider: { height: 1, marginVertical: 12 },
  chapterBlock: { marginBottom: 24 },
  chorusBlockDark: { backgroundColor: '#0b151b', padding: 16, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: '#d97706' },
  chorusBlockLight: { backgroundColor: '#f0fdf4', padding: 16, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: '#047857' },
  chapterLabel: { fontSize: 11, fontWeight: 'bold', color: '#64748b', marginBottom: 8, letterSpacing: 1 },
  lyricLine: { marginBottom: 6 },
  chorusTextDark: { color: '#f8fafc' },
  chorusTextLight: { color: '#065f46' },

  // Sermon Form UI Styles
  formContainer: { padding: 20, maxWidth: 540, marginHorizontal: 'auto', width: '100%' },
  formLabel: { fontSize: 14, fontWeight: 'bold', marginBottom: 6, marginTop: 14 },
  formInput: { height: 48, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, fontSize: 16 },
  formTextarea: { height: 280, paddingVertical: 12 },

  // Sermon Reader UI Styles
  noteViewDate: { fontSize: 14, color: '#64748b', fontWeight: '600', marginBottom: 6 },
  noteViewTopic: { fontSize: 28, fontWeight: 'bold', marginBottom: 16, lineHeight: 36 },
  noteMetaRow: { padding: 14, borderRadius: 8, borderWidth: 1, marginBottom: 12 },
  noteViewBody: { lineHeight: 28, letterSpacing: 0.3 }
});