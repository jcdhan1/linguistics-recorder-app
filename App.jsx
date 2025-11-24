import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMaterial3Theme } from '@pchmn/expo-material3-theme';
import { Audio } from 'expo-av';
import Constants from 'expo-constants';
import * as FileSystem from 'expo-file-system/legacy';
import { useEffect, useState } from 'react';
import {
	Alert,
	Appearance,
	Platform,
	ScrollView,
	StatusBar,
	StyleSheet,
	Text,
	TouchableOpacity,
	useColorScheme,
	View,
} from 'react-native';
import { MD3DarkTheme, MD3LightTheme, PaperProvider } from 'react-native-paper';
import { SafeAreaView } from "react-native-safe-area-context";

// --- CONFIGURATION ---
const RECORDINGS_DIR = FileSystem.documentDirectory + 'recordings/';
const DEFAULT_THEME = 'dark';

// Determine file extension based on platform
const getFileExtension = () => {
	if (Platform.OS === 'ios') return '.wav';
	if (Platform.OS === 'android') return '.ogg';
	return '.m4a'; // Web fallback
};

export default function App() {
	// --- THEME SETUP ---
	Appearance.setColorScheme(DEFAULT_THEME);
	const colorScheme = useColorScheme();
	const { theme } = useMaterial3Theme();
	const paperTheme =
		colorScheme === 'dark'
			? { ...MD3DarkTheme, colors: theme.dark }
			: { ...MD3LightTheme, colors: theme.light };

	const styles = StyleSheet.create({
		container: {
			flex: 1,
			backgroundColor: paperTheme.colors.background,
		},
		header: {
			padding: 20,
			alignItems: 'center',
			borderBottomWidth: 1,
			borderBottomColor: paperTheme.colors.primary,
		},
		headerTitle: {
			fontSize: 20,
			fontWeight: 'bold',
			color: paperTheme.colors.onBackground,
		},
		contentContainer: {
			flex: 1,
			padding: 20,
		},
		recorderContainer: {
			alignItems: 'center',
			marginBottom: 40,
			marginTop: 20,
		},
		recordButton: {
			width: 100,
			height: 100,
			borderColor: paperTheme.colors.onBackground,
			borderRadius: 50,
			justifyContent: 'center',
			alignItems: 'center',
			shadowColor: paperTheme.colors.shadow,
			shadowOffset: { width: 0, height: 4 },
			shadowOpacity: 0.3,
			shadowRadius: 4.65,
			elevation: 8,
		},
		recordingIdle: {
			backgroundColor: paperTheme.colors.primary,
			borderWidth: 1,
		},
		recordingActive: {
			backgroundColor: paperTheme.colors.primaryContainer,
			borderWidth: 4,
		},
		statusText: {
			color: paperTheme.colors.onBackground,
			marginTop: 15,
			fontSize: 16,
		},
		listContainer: {
			flex: 1,
		},
		listHeader: {
			color: paperTheme.colors.onBackground,
			fontSize: 18,
			marginBottom: 15,
			fontWeight: '600',
		},
		scrollContent: {
			paddingBottom: 20,
		},
		recordingItem: {
			backgroundColor: paperTheme.colors.primaryContainer,
			borderRadius: 12,
			padding: 15,
			marginBottom: 10,
			flexDirection: 'row',
			justifyContent: 'space-between',
			alignItems: 'center',
		},
		fileInfo: {
			flex: 1,
		},
		fileName: {
			color: paperTheme.colors.onPrimaryContainer,
			fontSize: 16,
			fontWeight: '500',
		},
		fileDate: {
			color: paperTheme.colors.secondary,
			fontSize: 12,
			marginTop: 4,
		},
		actions: {
			flexDirection: 'row',
			alignItems: 'center',
		},
		actionButton: {
			width: 40,
			height: 40,
			borderRadius: 20,
			justifyContent: 'center',
			alignItems: 'center',
			marginLeft: 10,
		},
		playBtn: {
			backgroundColor: paperTheme.colors.primary,
		},
		deleteBtn: {
			backgroundColor: paperTheme.colors.secondary,
		},
		emptyText: {
			color: paperTheme.colors.onBackground,
			textAlign: 'center',
			marginTop: 20,
			fontStyle: 'italic',
		},
	});

	// --- STATE VARIABLES ---
	const [recording, setRecording] = useState(null);
	const [sound, setSound] = useState(null);
	const [isRecording, setIsRecording] = useState(false);
	const [isPlaying, setIsPlaying] = useState(false);
	const [playingUri, setPlayingUri] = useState(null);
	const [recordings, setRecordings] = useState([]);
	const [permissionResponse, requestPermission] = Audio.usePermissions();

	// --- INITIAL SETUP ---
	useEffect(() => {
		ensureDirExists();
		loadRecordings();

		// Cleanup sounds on unmount
		return () => {
			if (sound) {
				sound.unloadAsync();
			}
		};
	}, []);

	// Create the recordings directory if it doesn't exist
	const ensureDirExists = async () => {
		const dirInfo = await FileSystem.getInfoAsync(RECORDINGS_DIR);
		if (dirInfo.exists) {
			return;
		} else {
			await FileSystem.makeDirectoryAsync(RECORDINGS_DIR);
			console.log("Recordings directory created");
		}
	};

	// Load existing files
	const loadRecordings = async () => {
		try {
			await ensureDirExists();
			const files = await FileSystem.readDirectoryAsync(RECORDINGS_DIR);

			// Map files to object structure and sort by newest
			const fileList = files.map(filename => ({
				name: filename,
				uri: RECORDINGS_DIR + filename,
				date: filename.split('_')[1]?.split('.')[0] || Date.now() // Extract timestamp from name
			})).sort((a, b) => b.date - a.date);

			setRecordings(fileList);
		} catch (error) {
			console.error("Error loading recordings", error);
		}
	};

	// --- RECORDING LOGIC ---
	async function startRecording() {
		try {
			// Request permissions
			if (permissionResponse.status !== 'granted') {
				console.log('Requesting permission..');
				await requestPermission();
			}

			// Configure audio mode
			await Audio.setAudioModeAsync({
				allowsRecordingIOS: true,
				playsInSilentModeIOS: true,
				staysActiveInBackground: true,
				shouldDuckAndroid: true,
				playThroughEarpieceAndroid: false,
			});

			// Platform specific recording options
			const recordingOptions = {
				...Audio.RecordingOptionsPresets.HIGH_QUALITY,
				android: {
					...Audio.RecordingOptionsPresets.HIGH_QUALITY.android,
					extension: '.ogg',
					outputFormat: Audio.AndroidOutputFormat.MPEG_4,
					audioEncoder: Audio.AndroidAudioEncoder.AAC,
				},
				ios: {
					...Audio.RecordingOptionsPresets.HIGH_QUALITY.ios,
					extension: '.wav',
					outputFormat: Audio.IOSOutputFormat.LINEARPCM,
					audioQuality: Audio.IOSAudioQuality.MAX,
					bitRateStrategy: Audio.IOSBitRateStrategy.CONSTANT,
					sampleRate: 44100,
					numberOfChannels: 2,
					bitRate: 128000,
					linearPCMBitDepth: 16,
					linearPCMIsBigEndian: false,
					linearPCMIsFloat: false,
				},
				web: {
					mimeType: 'audio/webm',
					bitsPerSecond: 128000,
				},
			};

			const { recording } = await Audio.Recording.createAsync(recordingOptions);
			setRecording(recording);
			setIsRecording(true);
			console.log('Recording started');
		} catch (err) {
			console.error('Failed to start recording', err);
			Alert.alert('Error', 'Failed to start recording');
		}
	}

	async function stopRecording() {
		if (!recording) return;

		console.log('Stopping recording..');
		setIsRecording(false);
		await recording.stopAndUnloadAsync();

		const uri = recording.getURI();
		setRecording(null);

		// Move file to our permanent directory with a timestamp name
		const extension = getFileExtension();
		const timestamp = Date.now();
		const newFilename = `rec_${timestamp}${extension}`;
		const newUri = RECORDINGS_DIR + newFilename;

		try {
			await FileSystem.moveAsync({
				from: uri,
				to: newUri
			});
			console.log('File saved to', newUri);
			loadRecordings(); // Refresh list
		} catch (error) {
			console.error('Error saving file', error);
		}
	}

	// --- PLAYBACK LOGIC ---
	async function playSound(uri) {
		try {
			// If already playing this file, stop it (toggle)
			if (sound && playingUri === uri && isPlaying) {
				await sound.pauseAsync();
				setIsPlaying(false);
				return;
			}

			// Unload previous sound if exists
			if (sound) {
				await sound.unloadAsync();
			}

			const { sound: newSound } = await Audio.Sound.createAsync(
				{ uri },
				{ shouldPlay: true }
			);

			setSound(newSound);
			setPlayingUri(uri);
			setIsPlaying(true);

			// Reset state when playback finishes
			newSound.setOnPlaybackStatusUpdate((status) => {
				if (status.didJustFinish) {
					setIsPlaying(false);
					setPlayingUri(null);
				}
			});
		} catch (error) {
			console.error('Error playing sound', error);
			Alert.alert('Error', 'Could not play audio file');
		}
	}

	// --- DELETE LOGIC ---
	async function deleteRecording(uri) {
		try {
			if (sound && playingUri === uri) {
				await sound.unloadAsync();
				setPlayingUri(null);
				setIsPlaying(false);
			}

			await FileSystem.deleteAsync(uri);
			console.log('Deleted file', uri);
			loadRecordings();
		} catch (error) {
			console.error('Error deleting file', error);
		}
	}

	// --- UI RENDERING ---
	const renderItem = (item) => {
		const isThisPlaying = isPlaying && playingUri === item.uri;
		const date = new Date(parseInt(item.name.split('_')[1])).toLocaleString();

		return (
			<View key={item.uri} style={styles.recordingItem}>
				<View style={styles.fileInfo}>
					<Text style={styles.fileName}>Recording</Text>
					<Text style={styles.fileDate}>{date}</Text>
				</View>

				<View style={styles.actions}>
					<TouchableOpacity
						style={[styles.actionButton, styles.playBtn]}
						onPress={() => playSound(item.uri)}
					>
						<MaterialCommunityIcons
							name={isThisPlaying ? "pause" : "play"}
							size={24}
							color={paperTheme.colors.onPrimary}
						/>
					</TouchableOpacity>

					<TouchableOpacity
						style={[styles.actionButton, styles.deleteBtn]}
						onPress={() => deleteRecording(item.uri)}
					>
						<MaterialCommunityIcons name="close" size={20} color={paperTheme.colors.onSecondary} />
					</TouchableOpacity>
				</View>
			</View>
		);
	};

	return (
		<PaperProvider theme={paperTheme}>
			<SafeAreaView style={styles.container}>
				<StatusBar barStyle="light-content" />
				<View style={styles.header}>
					<Text style={styles.headerTitle}>{Constants.expoConfig?.name}</Text>
				</View>

				{/* LIST OF RECORDINGS */}
				<View style={styles.contentContainer}>
					<View style={styles.listContainer}>
						<Text style={styles.listHeader}>Previous recordings</Text>
						<ScrollView contentContainerStyle={styles.scrollContent}>
							{recordings.length === 0 ? (
								<Text style={styles.emptyText}>No recordings yet</Text>
							) : (
								recordings.map(renderItem)
							)}
						</ScrollView>
					</View>
				</View>

				{/* RECORDER UI */}
				<View style={styles.recorderContainer}>
					<TouchableOpacity
						style={[
							styles.recordButton,
							isRecording ? styles.recordingActive : styles.recordingIdle
						]}
						onPress={isRecording ? stopRecording : startRecording}
					>
						<MaterialCommunityIcons
							name={isRecording ? "stop" : "microphone"}
							size={64}
							color={isRecording ? paperTheme.colors.onPrimaryContainer : paperTheme.colors.onPrimary}
						/>
					</TouchableOpacity>
					<Text style={styles.statusText}>
						{isRecording ? 'Recording...' : 'Tap to record'}
					</Text>
				</View>
			</SafeAreaView>
		</PaperProvider>
	);
}
