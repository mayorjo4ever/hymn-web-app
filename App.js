import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, TextInput, ScrollView, TouchableOpacity, Modal, StatusBar } from 'react-native';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware'; 
import AsyncStorage from '@react-native-async-storage/async-storage'; 
import * as Speech from 'expo-speech';
import hymnData from './assets/fullsongs.json';

// ==========================================================
// ZUSTAND GLOBAL STORAGE ENGINE (SAVES PREFERENCES TO DISK)
// ==========================================================
const useHymnStore = create(
  persist(
    (set) => ({
      favorites: [],
      fontSize: 18,
      theme: 'dark',
      
      toggleFavorite: (id) => set((state) => ({
        favorites: state.favorites.includes(id)
          ? state.favorites.filter((favId) => favId !== id)
          : [...state.favorites, id]
      })),
      
      setFontSize: (size) => set({ fontSize: size }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
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

  const { favorites, toggleFavorite, fontSize, setFontSize, theme, toggleTheme } = useHymnStore();

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

  // ==========================================================
  // SPEECH ENGINE (OPTIMIZED FOR NARRATING SACRED LYRICS)
  // ==========================================================
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
      language: 'en', 
      pitch: 0.98,      
      rate: 0.78,       
      onDone: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false)
    });
  };

  // Filter Search Filter Logic
  const displayHymns = hymnData.hymns.filter(hymn => {
    if (activeTab === 'favorites' && !favorites.includes(hymn.id)) return false;
    const query = searchQuery.toLowerCase().trim();
    if (!query) return true;
    return (
      (hymn.title && hymn.title.toLowerCase().includes(query)) ||
      (hymn.id && hymn.id.toString().includes(query)) ||
      (hymn.chapters && hymn.chapters.some(chap => chap.verses && chap.verses.some(line => line.toLowerCase().includes(query))))
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
      
      {/* APP TOP TITLE BAR */}
      <View style={[styles.header, themeHeader]}>
        <Text style={isDark ? styles.headerSubtitleDark : styles.headerSubtitleLight}>ONLY BELIEVE</Text>
        <Text style={styles.headerTitle}>Hymns</Text>
      </View>

      <View style={styles.mainContent}>
        {/* HYMNS VIEWS */}
        {(activeTab === 'all' || activeTab === 'favorites') && (
          <View style={styles.viewport}>
            <View style={[styles.searchWrapper, isDark ? styles.searchDark : styles.searchLight, themeBorder]}>
              <Text style={styles.searchIconInline}>🔍</Text>
              <TextInput 
                style={[styles.searchBar, { color: isDark ? '#f8fafc' : '#1e293b' }]}
                placeholder={activeTab === 'favorites' ? "Search favorite hymns..." : "Search by number, title, or words..."}
                placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearSearchBtn}>
                  <Text style={{ color: isDark ? '#94a3b8' : '#64748b', fontWeight: 'bold' }}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
              {displayHymns.map((item) => {
                const isFav = favorites.includes(item.id);
                return (
                  <TouchableOpacity key={item.id} style={[styles.card, themeCard, themeBorder]} activeOpacity={0.85} onPress={() => setSelectedHymn(item)}>
                    <View style={styles.cardRow}>
                      <View style={[styles.numberContainer, isDark ? styles.numDark : styles.numLight, themeBorder]}>
                        <Text style={[styles.numberBadge, { color: isDark ? '#f59e0b' : '#047857' }]}>{item.id}</Text>
                      </View>
                      <View style={styles.cardInfoBlock}>
                        <Text style={[styles.cardText, themeText]} numberOfLines={1}>{item.title}</Text>
                        <Text style={styles.subText}>{item.piano ? `🎹 Key: ${item.piano}` : 'Hymn Lyric Matrix'}</Text>
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

        {/* SETTINGS MODULE WITH EMBEDDED ABOUT SCREEN */}
        {activeTab === 'settings' && (
          <ScrollView style={styles.viewport} showsVerticalScrollIndicator={false}>
            <Text style={[styles.sectionTitle, themeText]}>Display Settings</Text>
            
            <View style={[styles.settingCard, themeCard, themeBorder]}>
              <View style={styles.settingMetaText}>
                <Text style={[styles.settingLabel, themeText]}>Application Theme</Text>
                <Text style={styles.settingSubLabel}>Currently: {isDark ? 'Midnight Gold' : 'Pure Light'}</Text>
              </View>
              <TouchableOpacity style={[styles.themeToggleButton, { backgroundColor: isDark ? '#f59e0b' : '#047857' }]} onPress={toggleTheme}>
                <Text style={styles.themeToggleBtnText}>{isDark ? '☀️ Light Mode' : '🌙 Dark Mode'}</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.settingCard, themeCard, themeBorder]}>
              <View style={styles.settingMetaText}>
                <Text style={[styles.settingLabel, themeText]}>Reader Text Size</Text>
                <Text style={styles.settingSubLabel}>Adjust spacing for lyrics layout</Text>
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

            {/* ℹ️ ESSENTIAL ABOUT MODULE ATTACHED BELOW */}
            <Text style={[styles.sectionTitle, themeText, { marginTop: 12 }]}>About</Text>
            <View style={[styles.aboutSurface, themeCard, themeBorder]}>
              <Text style={[styles.aboutAppTitle, themeText]}>Only Believe Hymns</Text>
              <Text style={styles.aboutAppVersion}>Version 2.0.0</Text>
              <View style={[styles.luxuryDivider, { backgroundColor: isDark ? '#1e293b' : '#e2e8f0', marginVertical: 12 }]} />
              <Text style={[styles.aboutDescriptionText, { color: isDark ? '#94a3b8' : '#475569' }]}>
                This Only Believe Hymn is dedicated for the bride of Christ World Wide, for more updates and support, Contact Bro Mayowa Ojo, @Ilorin Christian Assembly, 07030577951, Ilorinchristianassembly@gmail.com
              </Text>
              <View style={[styles.offlineBadge, { backgroundColor: isDark ? '#111827' : '#f1f5f9' }]}>
                <Text style={[styles.offlineBadgeText, { color: isDark ? '#f59e0b' : '#047857' }]}>
                  🔒 Remain Blessed as we awaits the coming of The Lord
                </Text>
              </View>
            </View>
            
            {/* Safe scrolling spacing anchor */}
            <View style={{ height: 40 }} />
          </ScrollView>
        )}
      </View>

      {/* CORE USER BOTTOM BAR */}
      <View style={[styles.tabBar, { backgroundColor: isDark ? '#0b132b' : '#ffffff', borderTopColor: isDark ? '#1e293b' : '#e2e8f0' }]}>
        <TouchableOpacity style={[styles.tabItem, activeTab === 'all' && (isDark ? styles.activeTabDark : styles.activeTabLight)]} onPress={() => setActiveTab('all')}>
          <Text style={[styles.tabIcon, activeTab === 'all' && styles.opacityFull]}>🎶</Text>
          <Text style={[styles.tabLabel, activeTab === 'all' && { color: isDark ? '#f59e0b' : '#047857', fontWeight: 'bold' }]}>Hymns</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabItem, activeTab === 'favorites' && (isDark ? styles.activeTabDark : styles.activeTabLight)]} onPress={() => setActiveTab('favorites')}>
          <Text style={[styles.tabIcon, activeTab === 'favorites' && styles.opacityFull]}>⭐</Text>
          <Text style={[styles.tabLabel, activeTab === 'favorites' && { color: isDark ? '#f59e0b' : '#047857', fontWeight: 'bold' }]}>Favorites</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabItem, activeTab === 'settings' && (isDark ? styles.activeTabDark : styles.activeTabLight)]} onPress={() => setActiveTab('settings')}>
          <Text style={[styles.tabIcon, activeTab === 'settings' && styles.opacityFull]}>⚙️</Text>
          <Text style={[styles.tabLabel, activeTab === 'settings' && { color: isDark ? '#f59e0b' : '#047857', fontWeight: 'bold' }]}>Settings</Text>
        </TouchableOpacity>
      </View>

      {/* LYRIC CONTAINER MODAL DISPLAY */}
      <Modal visible={selectedHymn !== null} animationType="slide" transparent={false} onRequestClose={handleCloseModal}>
        {selectedHymn && (
          <View style={[styles.modalContainer, themeBg]}>
            <View style={[styles.modalHeader, { backgroundColor: isDark ? '#0b132b' : '#047857', borderBottomColor: isDark ? '#1e293b' : '#046a4e' }]}>
              <TouchableOpacity onPress={handleCloseModal} style={[styles.closeButton, { backgroundColor: isDark ? '#1e293b' : 'rgba(255,255,255,0.2)' }]}>
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>✕ Close</Text>
              </TouchableOpacity>
              <Text style={styles.modalHeaderTitle}>Hymn {selectedHymn.id}</Text>
              <TouchableOpacity onPress={() => toggleFavorite(selectedHymn.id)} style={[styles.modalFavoriteButton, { backgroundColor: isDark ? '#d97706' : '#f59e0b' }]}>
                <Text style={{ color: isDark ? '#fff' : '#1e293b', fontWeight: 'bold', fontSize: 14 }}>
                  {favorites.includes(selectedHymn.id) ? '★ Saved' : '☆ Save'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* FLOATING ICON AUDIO PANEL */}
            <View style={[styles.audioDock, { backgroundColor: isDark ? '#0f172a' : '#f1f5f9', borderBottomColor: isDark ? '#1e293b' : '#e2e8f0' }]}>
              <View style={styles.audioDockFlexRow}>
                <TouchableOpacity 
                  style={[styles.audioIconBtn, isSpeaking ? styles.audioIconBtnStop : styles.audioIconBtnPlay]} 
                  onPress={() => handleTextToSpeech(selectedHymn)}
                >
                  <Text style={styles.audioIconText}>{isSpeaking ? '⏹️' : '🔊'}</Text>
                </TouchableOpacity>
                <View style={styles.statusTextContainer}>
                  <Text style={styles.audioStatusText} numberOfLines={1}>
                    {isSpeaking ? "Narrating lyrics aloud..." : "Tap icon to hear reading"}
                  </Text>
                </View>
              </View>
            </View>

            <ScrollView contentContainerStyle={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={[styles.hymnMainTitle, themeText]}>{selectedHymn.title}</Text>
              <View style={[styles.luxuryDivider, { backgroundColor: isDark ? '#1e293b' : '#e2e8f0' }]} />

              {selectedHymn.chapters && selectedHymn.chapters.map((chap, index) => {
                const isChorus = chap.chapter && chap.chapter.toString().toLowerCase() === 'chorus';
                return (
                  <View key={index} style={[styles.chapterBlock, isChorus && (isDark ? styles.chorusBlockDark : styles.chorusBlockLight)]}>
                    <Text style={[styles.chapterLabel, isChorus && { color: isDark ? '#d97706' : '#047857' }]}>
                      {isChorus ? 'CHORUS' : `STANZA ${chap.chapter}`}
                    </Text>
                    {chap.verses && chap.verses.map((line, lIdx) => (
                      <Text key={lIdx} style={[styles.lyricLine, { fontSize, lineHeight: fontSize + 12 }, isChorus ? (isDark ? styles.chorusTextDark : styles.chorusTextLight) : themeText]}>
                        {line}
                      </Text>
                    ))}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}
      </Modal>
    </View>
  );
}

// ==========================================================
// CENTRAL GLOBAL STYLE SHEET DESIGN GRAPH
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
  header: { paddingTop: 24, paddingBottom: 20, alignItems: 'center', borderBottomWidth: 1, elevation: 4 },
  headerTitle: { color: '#f8fafc', fontSize: 24, fontWeight: 'bold', letterSpacing: 0.5 },
  mainContent: { flex: 1, width: '100%', maxWidth: 540, marginHorizontal: 'auto' },
  viewport: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  
  searchWrapper: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, marginBottom: 16, height: 52 },
  searchDark: { backgroundColor: '#1e293b' },
  searchLight: { backgroundColor: '#ffffff' },
  searchIconInline: { fontSize: 16, marginRight: 8, opacity: 0.5 },
  searchBar: { flex: 1, fontSize: 16, outlineStyle: 'none', height: '100%' },
  clearSearchBtn: { padding: 4, marginLeft: 4 },
  
  listContainer: { flex: 1 },
  card: { padding: 16, borderRadius: 12, marginVertical: 6, borderWidth: 1, elevation: 1 },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  numberContainer: { width: 44, height: 44, borderRadius: 8, justifyContent: 'center', alignItems: 'center', marginRight: 14, borderWidth: 1 },
  numDark: { backgroundColor: '#1e293b' },
  numLight: { backgroundColor: '#f1f5f9' },
  numberBadge: { fontWeight: 'bold', fontSize: 16 },
  cardInfoBlock: { flex: 1, justifyContent: 'center' },
  cardText: { fontSize: 17, fontWeight: '600', marginBottom: 2 },
  subText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  inlineFavTouch: { paddingHorizontal: 8, paddingVertical: 4 },
  heartIcon: { fontSize: 22 },
  
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16, letterSpacing: 0.5 },
  settingCard: { padding: 16, borderRadius: 12, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  settingMetaText: { flex: 1 },
  settingLabel: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  settingSubLabel: { fontSize: 12, color: '#64748b' },
  themeToggleButton: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8 },
  themeToggleBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 14 },
  buttonRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 8, padding: 4 },
  sizeButton: { width: 36, height: 36, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  sizeIndicatorValue: { paddingHorizontal: 12 },

  // Dedicated Styling for the Embedded About View Panel
  aboutSurface: { padding: 20, borderRadius: 12, borderWidth: 1, marginTop: 4 },
  aboutAppTitle: { fontSize: 18, fontWeight: 'bold' },
  aboutAppVersion: { fontSize: 13, color: '#64748b', marginTop: 2, fontWeight: '500' },
  aboutDescriptionText: { fontSize: 14, lineHeight: 22, marginTop: 4 },
  offlineBadge: { padding: 10, borderRadius: 8, marginTop: 16, alignItems: 'center' },
  offlineBadgeText: { fontSize: 13, fontWeight: '600' },
  
  tabBar: { flexDirection: 'row', height: 72, borderTopWidth: 1, justifyContent: 'space-around', alignItems: 'center' },
  tabItem: { alignItems: 'center', flex: 1, height: '100%', justifyContent: 'center' },
  activeTabDark: { borderTopWidth: 3, borderTopColor: '#f59e0b', marginTop: -3 },
  activeTabLight: { borderTopWidth: 3, borderTopColor: '#047857', marginTop: -3 },
  tabIcon: { fontSize: 20, marginBottom: 3, opacity: 0.4 },
  opacityFull: { opacity: 1 },
  tabLabel: { fontSize: 12 },
  
  modalContainer: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, paddingHorizontal: 16, borderBottomWidth: 1 },
  closeButton: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 },
  modalHeaderTitle: { color: '#fff', fontSize: 17, fontWeight: 'bold' },
  modalFavoriteButton: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8 },
  
  audioDock: { padding: 12, borderBottomWidth: 1 },
  audioDockFlexRow: { flexDirection: 'row', alignItems: 'center', gap: 12, maxWidth: 540, width: '100%', marginHorizontal: 'auto' },
  audioIconBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', elevation: 2 },
  audioIconBtnPlay: { backgroundColor: '#10b981' },
  audioIconBtnStop: { backgroundColor: '#ef4444' },
  audioIconText: { fontSize: 18, color: '#ffffff' },
  statusTextContainer: { flex: 1, justifyContent: 'center' },
  audioStatusText: { fontSize: 13, color: '#64748b', fontWeight: '500' },
  
  modalBody: { paddingHorizontal: 24, paddingVertical: 28, maxWidth: 540, marginHorizontal: 'auto', width: '100%' },
  hymnMainTitle: { fontSize: 26, fontWeight: 'bold', textAlign: 'center', marginBottom: 14, letterSpacing: 0.5 },
  luxuryDivider: { height: 1, marginVertical: 16 },
  chapterBlock: { marginBottom: 28 },
  chorusBlockDark: { backgroundColor: '#0b151b', padding: 18, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: '#d97706', marginVertical: 4 },
  chorusBlockLight: { backgroundColor: '#f0fdf4', padding: 18, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: '#047857', marginVertical: 4 },
  chapterLabel: { fontSize: 12, fontWeight: 'bold', color: '#64748b', marginBottom: 10, letterSpacing: 1.5 },
  lyricLine: { marginBottom: 8, letterSpacing: 0.3 },
  chorusTextDark: { color: '#f8fafc', fontWeight: '500' },
  chorusTextLight: { color: '#065f46', fontWeight: '500' }
});