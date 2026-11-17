// Backend Firebase (opcional). Si no hay configuración en variables VITE_FIREBASE_*,
// el juego funciona offline y estas funciones no hacen nada.
// Se carga con import() dinámico para no penalizar el arranque en móvil.

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
};

export const backendEnabled = !!cfg.apiKey && !!cfg.projectId;

let ready: Promise<{ db: any; uid: string; fs: typeof import('firebase/firestore') } | null> | null = null;

export function initBackend() {
  if (!backendEnabled) return Promise.resolve(null);
  if (!ready) {
    ready = (async () => {
      try {
        const [{ initializeApp }, auth, fs] = await Promise.all([
          import('firebase/app'), import('firebase/auth'), import('firebase/firestore'),
        ]);
        const app = initializeApp(cfg as Record<string, string>);
        const a = auth.getAuth(app);
        const cred = await auth.signInAnonymously(a);
        return { db: fs.getFirestore(app), uid: cred.user.uid, fs };
      } catch (e) {
        console.warn('[backend] Firebase no disponible, modo offline', e);
        return null;
      }
    })();
  }
  return ready;
}

export interface MatchRecord {
  sport: string;
  difficulty: string;
  points: number;
  scoreA: number;
  scoreB: number;
  won: boolean;
  specials: number;
  perfects: number;
  longestRally: number;
}

export async function saveMatch(m: MatchRecord) {
  const b = await initBackend();
  if (!b) return;
  const { db, uid, fs } = b;
  try {
    await fs.addDoc(fs.collection(db, 'matches'), { ...m, uid, createdAt: fs.serverTimestamp() });
    await fs.setDoc(fs.doc(db, 'players', uid), {
      played: fs.increment(1),
      wins: fs.increment(m.won ? 1 : 0),
      specials: fs.increment(m.specials),
      updatedAt: fs.serverTimestamp(),
    }, { merge: true });
  } catch (e) {
    console.warn('[backend] no se pudo guardar la partida', e);
  }
}

export async function getMyStats(): Promise<{ played: number; wins: number } | null> {
  const b = await initBackend();
  if (!b) return null;
  try {
    const snap = await b.fs.getDoc(b.fs.doc(b.db, 'players', b.uid));
    return snap.exists() ? (snap.data() as any) : { played: 0, wins: 0 };
  } catch { return null; }
}
