import React, { useState, useEffect, useRef } from "react";
import {
  User,
  Settings,
  X,
  Plus,
  Star,
  Search,
  Loader2,
  Dices,
  Layers,
  Users,
  BarChart3,
  Heart,
  UserMinus,
} from "lucide-react";

// ---------------------------------------------------------------------------
// TABLE LAYOUTS — the single source of truth for where each seat physically
// sits on the device. row/col/span describe the seat's cell in the main grid,
// rotated marks seats whose tiles render upside-down (players across the
// table). The commander damage mini-grid and popup both derive their box
// positions from this, so they always mirror the actual table.
// ---------------------------------------------------------------------------
const TABLE_LAYOUTS = {
  2: {
    rows: 2,
    cols: 1,
    cells: [
      { row: 0, col: 0, span: 1, rotated: true },
      { row: 1, col: 0, span: 1, rotated: false },
    ],
  },
  3: {
    rows: 2,
    cols: 2,
    cells: [
      { row: 0, col: 0, span: 1, rotated: true },
      { row: 0, col: 1, span: 1, rotated: true },
      { row: 1, col: 0, span: 2, rotated: false },
    ],
  },
  4: {
    rows: 2,
    cols: 2,
    cells: [
      { row: 0, col: 0, span: 1, rotated: true },
      { row: 0, col: 1, span: 1, rotated: true },
      { row: 1, col: 0, span: 1, rotated: false },
      { row: 1, col: 1, span: 1, rotated: false },
    ],
  },
  5: {
    rows: 3,
    cols: 2,
    cells: [
      { row: 0, col: 0, span: 1, rotated: true },
      { row: 0, col: 1, span: 1, rotated: true },
      { row: 1, col: 0, span: 1, rotated: false },
      { row: 1, col: 1, span: 1, rotated: false },
      { row: 2, col: 0, span: 2, rotated: false },
    ],
  },
};

// Where should seat `seatIndex`'s box be placed inside a grid that belongs to
// the viewer at `viewerIndex`? If the viewer's container is rotated 180° (top
// seats), we place cells at the 180°-rotated grid position so that, after the
// CSS rotation flips them back, every box lands in the same direction as the
// actual person at the table. Reversing a flat ID list (the old approach)
// only works for a full rectangle — this works for 3P and 5P layouts too.
// Arcade neon colors for the "GG" death screen — a fresh one is picked at
// random for each elimination (see the deathColors effect below).
const NEON_PALETTE = [
  { glow1: "#ff2fd6", glow2: "#2fe8ff" }, // magenta / cyan
  { glow1: "#39ff14", glow2: "#ff2fd6" }, // green / magenta
  { glow1: "#00e5ff", glow2: "#ffea00" }, // cyan / yellow
  { glow1: "#ff9500", glow2: "#ff2fd6" }, // orange / magenta
  { glow1: "#c644fc", glow2: "#39ff14" }, // purple / green
  { glow1: "#ffea00", glow2: "#00e5ff" }, // yellow / cyan
];

const getSeatCell = (playerCount, seatIndex, viewerIndex) => {
  const layout = TABLE_LAYOUTS[playerCount] || TABLE_LAYOUTS[4];
  const cell = layout.cells[seatIndex];
  const viewerRotated = layout.cells[viewerIndex]?.rotated;
  if (!viewerRotated) return cell;
  return {
    ...cell,
    row: layout.rows - 1 - cell.row,
    col: layout.cols - 1 - cell.col - (cell.span - 1),
  };
};

export default function App() {
  const makeSlot = (id) => ({
    id,
    label: `Slot ${id}`,
    player: null,
    life: 40,
    bgImage: "",
    commanderName: "",
    killedBySlotId: null,
    commanderDamage: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  });

  const [slots, setSlots] = useState([1, 2, 3, 4, 5].map(makeSlot));

  const [playerCount, setPlayerCount] = useState(4);
  const [startingLife, setStartingLife] = useState(40);
  const [dbPlayers, setDbPlayers] = useState([]);
  const [activeMenuSlot, setActiveMenuSlot] = useState(null);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [activeCmdSlotId, setActiveCmdSlotId] = useState(null);
  const [renamingPlayerId, setRenamingPlayerId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [gameHistory, setGameHistory] = useState([]);
  const [editingCmdSlot, setEditingCmdSlot] = useState(null);

  const longPressRefs = useRef({});
  const pointerDownOnTapTarget = useRef({});

  const [lifeDeltas, setLifeDeltas] = useState({});
  // Pending "clear this delta popup" timers, keyed by slot id — kept in a
  // ref (not state) so scheduling/clearing them is a plain side effect
  // instead of living inside the setLifeDeltas updater. Doing it inside the
  // updater used to work in production but silently leaked an orphaned
  // timer per tap in dev: React 18 Strict Mode intentionally calls state
  // updater functions twice to catch exactly this kind of impurity (a
  // function that schedules real timers as a side effect isn't safe to
  // call twice), and the throwaway second call still scheduled a real
  // setTimeout with no reference kept to cancel it — so ~5s after your
  // *first* tap in a streak, that leaked timer would fire and wipe the
  // popup regardless of how many times you'd tapped since, making it look
  // like the count "restarted" mid-streak. Production builds don't run
  // Strict Mode's double-invoke, which is why it only showed up in dev.
  const lifeDeltaTimers = useRef({});
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [playerFavorites, setPlayerFavorites] = useState([]);
  // When a search result has more than one printing, this holds the list of
  // printings (each its own art) so the player can pick a specific one
  // instead of always getting whichever printing Scryfall returns first.
  const [printingsOptions, setPrintingsOptions] = useState(null);
  const [printingsForName, setPrintingsForName] = useState("");
  const [isLoadingPrintings, setIsLoadingPrintings] = useState(false);
  // Which half of the drawer is showing for an assigned player — browsing
  // existing favorites, or adding new art. Keeping these on separate tabs
  // instead of one long stacked column is the fix for "scatterbrained".
  const [drawerTab, setDrawerTab] = useState("favorites");
  // Long-press-to-delete on favorite cards: which favorite (by id) is
  // currently "armed" and showing its delete overlay. A plain tap selects
  // the commander; holding for ~500ms arms delete mode instead, and a
  // second, separate tap on the armed card confirms the delete — mirroring
  // the long-press pattern used elsewhere in the app (life ±5, commander
  // damage) instead of a native confirm() dialog.
  const [armedDeleteFavId, setArmedDeleteFavId] = useState(null);
  const favJustArmed = useRef(false);
  // "Add New" tab defaults to the simple, primary flow — Scryfall art
  // search — with custom-art upload tucked behind this toggle so it isn't
  // another always-visible form competing for attention.
  const [showCustomUpload, setShowCustomUpload] = useState(false);
  const [showControlHub, setShowControlHub] = useState(false);
  const [startingPlayerId, setStartingPlayerId] = useState(null);
  const [isRolling, setIsRolling] = useState(false);

  // Monarch / Initiative designations (slot ids)
  const [monarchSlotId, setMonarchSlotId] = useState(null);
  const [initiativeSlotId, setInitiativeSlotId] = useState(null);

  // Temporarily allow life adjustments on a defeated slot
  const [adjustingSlotId, setAdjustingSlotId] = useState(null);
  const adjustTimerRef = useRef(null);

  // Coin flip + dice state
  const [showCoinFlip, setShowCoinFlip] = useState(false);
  const [coinFlipCount, setCoinFlipCount] = useState(1);
  const [coinFlipResults, setCoinFlipResults] = useState([]);
  const [isFlipping, setIsFlipping] = useState(false);
  const [diceResults, setDiceResults] = useState(null); // { sides, values }
  const [isRollingDice, setIsRollingDice] = useState(false);

  // Win screen state — a win is PENDING until confirmed, so an accidental
  // tap that drops the last opponent to 0 never writes to the database.
  const [winner, setWinner] = useState(null);
  const [winConfirmed, setWinConfirmed] = useState(false);
  const autoWinTriggered = useRef(false);

  // A "short" viewport (landscape phone, mainly) doesn't have enough
  // vertical room for the normal fixed-size tile content — same problem
  // the 5-player pod already solves with clamp()-based compact sizing.
  // Tracking this lets every pod size borrow that compact styling instead
  // of only ever engaging it for playerCount === 5.
  const [isShortViewport, setIsShortViewport] = useState(
    () => typeof window !== "undefined" && window.innerHeight <= 500,
  );
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(max-height: 500px)");
    const handleChange = (e) => setIsShortViewport(e.matches);
    setIsShortViewport(mq.matches);
    mq.addEventListener("change", handleChange);
    return () => mq.removeEventListener("change", handleChange);
  }, []);

  // Configurable via .env (VITE_API_URL) so local dev doesn't require
  // editing source. Falls back to the production deployment.
  const BACKEND_URL =
    import.meta.env.VITE_API_URL || "https://life.mckaykleinman.com/api";
  const ASSET_ORIGIN = BACKEND_URL.replace(/\/api\/?$/, "");

  // Custom uploads are stored as relative paths ("/custom-art/...") so they
  // survive domain/IP changes. Older rows may still hold absolute URLs.
  const resolveArt = (url) => {
    if (!url) return "";
    return url.startsWith("http") ? url : `${ASSET_ORIGIN}${url}`;
  };

  const visibleSlots = slots.slice(0, playerCount);
  const layout = TABLE_LAYOUTS[playerCount] || TABLE_LAYOUTS[4];
  // 5P always squeezes tiles to a third of the screen height, so it always
  // gets the clamp()-based compact sizing. Any other pod size gets it too
  // whenever the viewport itself is short (landscape phone, small window),
  // so nothing gets cut off regardless of pod size or orientation.
  const isCompact = playerCount === 5 || isShortViewport;

  // Lethal commander damage — only counts opponents actually in the current
  // pod, so shrinking the pod size mid-game can't kill someone with damage
  // from a now-hidden seat.
  const isLethalCmd = (slot) =>
    Object.entries(slot.commanderDamage).some(
      ([oppId, dmg]) => Number(oppId) <= playerCount && dmg >= 21,
    );

  const fetchGameHistory = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/games`);
      const data = await res.json();
      setGameHistory(data);
    } catch (err) {
      console.error("Error fetching game history:", err);
    }
  };

  // Fetching players also re-syncs any slot that holds a snapshot of that
  // player, so win counts shown on tiles/menus never go stale.
  const fetchPlayers = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/players`);
      const data = await res.json();
      setDbPlayers(data);
      setSlots((prev) =>
        prev.map((s) =>
          s.player
            ? { ...s, player: data.find((p) => p.id === s.player.id) || s.player }
            : s,
        ),
      );
    } catch (err) {
      console.error("Error fetching players:", err);
    }
  };

  useEffect(() => {
    fetchPlayers();
    fetchGameHistory();

    let wakeLock = null;
    const requestWakeLock = async () => {
      try {
        wakeLock = await navigator.wakeLock.request("screen");
      } catch (err) {
        console.log("Wake lock not supported:", err);
      }
    };
    requestWakeLock();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") requestWakeLock();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (wakeLock) wakeLock.release();
    };
  }, []);

  const activeMenuPlayer = slots.find((s) => s.id === activeMenuSlot)?.player;

  // Depend on the player id, not the whole slots array — otherwise every
  // life tick while the menu is open refires this fetch.
  useEffect(() => {
    if (activeMenuSlot === null) return;
    if (activeMenuPlayer) fetchFavorites(activeMenuPlayer.id);
    else setPlayerFavorites([]);
    setSearchQuery("");
    setSearchResults([]);
    setPrintingsOptions(null);
    setPrintingsForName("");
    setDrawerTab("favorites");
    setArmedDeleteFavId(null);
    setShowCustomUpload(false);
  }, [activeMenuSlot, activeMenuPlayer?.id]);

  const fetchFavorites = async (playerId) => {
    try {
      const res = await fetch(`${BACKEND_URL}/players/${playerId}/favorites`);
      const data = await res.json();
      setPlayerFavorites(data);
    } catch (err) {
      console.error("Error fetching favorites:", err);
    }
  };

  const handleDeleteGameEntry = async (gameId) => {
    try {
      const res = await fetch(`${BACKEND_URL}/games/${gameId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setGameHistory((prev) => prev.filter((g) => g.id !== gameId));
        // Win totals are computed from games server-side; refetch to sync.
        fetchPlayers();
      }
    } catch (err) {
      console.error("Error deleting game entry:", err);
    }
  };

  const handleCreatePlayer = async (e) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;
    try {
      const res = await fetch(`${BACKEND_URL}/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newPlayerName.trim() }),
      });
      if (res.ok) {
        setNewPlayerName("");
        fetchPlayers();
      }
    } catch (err) {
      console.error("Error creating player:", err);
    }
  };

  const handleDeletePlayer = async (playerId) => {
    if (!confirm("Delete this profile permanently?")) return;
    try {
      const res = await fetch(`${BACKEND_URL}/players/${playerId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchPlayers();
        setSlots((prev) =>
          prev.map((s) =>
            s.player?.id === playerId
              ? { ...s, player: null, bgImage: "", commanderName: "" }
              : s,
          ),
        );
      }
    } catch (err) {
      console.error("Error deleting player:", err);
    }
  };

  const handleRenamePlayer = async (playerId) => {
    if (!renameValue.trim()) return;
    try {
      const res = await fetch(`${BACKEND_URL}/players/${playerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameValue.trim() }),
      });
      if (res.ok) {
        fetchPlayers();
        setSlots((prev) =>
          prev.map((s) =>
            s.player?.id === playerId
              ? { ...s, player: { ...s.player, name: renameValue.trim() } }
              : s,
          ),
        );
        setRenamingPlayerId(null);
        setRenameValue("");
      }
    } catch (err) {
      console.error("Error renaming player:", err);
    }
  };

  const handleScryfallSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    try {
      const res = await fetch(
        `https://api.scryfall.com/cards/search?q=is:commander+name:${encodeURIComponent(searchQuery.trim())}`,
      );
      const data = await res.json();
      if (data.data) setSearchResults(data.data);
      else setSearchResults([]);
    } catch (err) {
      console.error("Scryfall search error:", err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSelectCommander = async (card) => {
    const currentSlot = slots.find((s) => s.id === activeMenuSlot);
    if (!currentSlot || !currentSlot.player) return;

    const image_url =
      card.image_uris?.art_crop ||
      card.card_faces?.[0]?.image_uris?.art_crop ||
      card.card_faces?.[1]?.image_uris?.art_crop ||
      "";

    if (!image_url)
      return alert("Could not extract art asset from Scryfall metadata.");

    try {
      await fetch(`${BACKEND_URL}/players/${currentSlot.player.id}/favorites`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commander_name: card.name,
          image_url,
          scryfall_id: card.id,
        }),
      });
      setSlots((prev) =>
        prev.map((s) =>
          s.id === activeMenuSlot
            ? { ...s, bgImage: image_url, commanderName: card.name }
            : s,
        ),
      );
      setPrintingsOptions(null);
      setActiveMenuSlot(null);
    } catch (err) {
      console.error("Error saving favorite:", err);
    }
  };

  // A search result only shows one art. Before saving it, check whether the
  // card has other printings (different arts) and, if so, let the player
  // pick which one instead of always saving whichever art Scryfall's
  // default search happened to return.
  const handleCardClick = async (card) => {
    setIsLoadingPrintings(true);
    try {
      const res = await fetch(
        `https://api.scryfall.com/cards/search?q=${encodeURIComponent(`!"${card.name}"`)}&unique=prints&order=released`,
      );
      const data = await res.json();
      const prints = (data.data || []).filter(
        (c) =>
          c.image_uris?.art_crop || c.card_faces?.[0]?.image_uris?.art_crop,
      );
      if (prints.length > 1) {
        setPrintingsOptions(prints);
        setPrintingsForName(card.name);
      } else {
        handleSelectCommander(card);
      }
    } catch (err) {
      console.error("Error fetching printings:", err);
      handleSelectCommander(card); // fall back to saving the original result
    } finally {
      setIsLoadingPrintings(false);
    }
  };

  const handleSelectExistingFavorite = (fav) => {
    setSlots((prev) =>
      prev.map((s) =>
        s.id === activeMenuSlot
          ? {
              ...s,
              bgImage: resolveArt(fav.image_url),
              commanderName: fav.commander_name || "Commander",
            }
          : s,
      ),
    );
    setActiveMenuSlot(null);
  };

  const handleDeleteFavorite = async (favId) => {
    try {
      const res = await fetch(`${BACKEND_URL}/favorites/${favId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setPlayerFavorites((prev) => prev.filter((f) => f.id !== favId));
      } else {
        console.error(
          "Error deleting favorite: server responded",
          res.status,
        );
      }
    } catch (err) {
      console.error("Error deleting favorite:", err);
    }
    setArmedDeleteFavId(null);
  };

  const assignPlayerToSlot = (slotId, playerObj) => {
    setSlots((prev) =>
      prev.map((s) =>
        s.id === slotId ? { ...s, player: playerObj, bgImage: "" } : s,
      ),
    );
  };

  const showLifeDelta = (id, amount) => {
    // Side effects live here, in the event handler itself — NOT inside the
    // setLifeDeltas updater below, which stays a pure function of its
    // previous state so it's safe for React to call however many times it
    // wants (see the note on lifeDeltaTimers above).
    if (lifeDeltaTimers.current[id]) clearTimeout(lifeDeltaTimers.current[id]);
    lifeDeltaTimers.current[id] = setTimeout(() => {
      delete lifeDeltaTimers.current[id];
      setLifeDeltas((p) => {
        const next = { ...p };
        delete next[id];
        return next;
      });
    }, 5000);

    setLifeDeltas((prev) => {
      const existing = prev[id];
      const newTotal = (existing?.amount ?? 0) + amount;
      return { ...prev, [id]: { amount: newTotal } };
    });
  };

  const updateLife = (id, amount) => {
    setSlots((prev) =>
      prev.map((s) => (s.id === id ? { ...s, life: s.life + amount } : s)),
    );
  };

  const updateCommanderDamage = (targetSlotId, opponentSlotId, amount) => {
    // Compute the delta that will ACTUALLY apply after clamping at 0, so
    // decrementing damage that's already 0 can't hand out free life.
    const target = slots.find((s) => s.id === targetSlotId);
    if (!target) return;
    const current = target.commanderDamage[opponentSlotId] || 0;
    const newDamage = Math.max(0, current + amount);
    const applied = newDamage - current;
    if (applied === 0) return;

    setSlots((prev) =>
      prev.map((s) => {
        if (s.id !== targetSlotId) return s;
        const newCmd = { ...s.commanderDamage, [opponentSlotId]: newDamage };
        // Recompute the killer from scratch: set it when a source crosses 21,
        // clear or reassign it if damage is ticked back below lethal.
        const lethalEntry = Object.entries(newCmd).find(
          ([oppId, dmg]) => Number(oppId) <= playerCount && dmg >= 21,
        );
        return {
          ...s,
          life: s.life - applied,
          commanderDamage: newCmd,
          killedBySlotId: lethalEntry ? Number(lethalEntry[0]) : null,
        };
      }),
    );
    showLifeDelta(targetSlotId, -applied);
  };

  const handleNewGameAndRoll = () => {
    setShowControlHub(false);
    setSlots((prev) =>
      prev.map((s) => ({
        ...s,
        life: startingLife,
        commanderDamage: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        killedBySlotId: null,
      })),
    );
    setStartingPlayerId(null);
    setIsRolling(true);
    Object.values(lifeDeltaTimers.current).forEach(clearTimeout);
    lifeDeltaTimers.current = {};
    setLifeDeltas({});
    setMonarchSlotId(null);
    setInitiativeSlotId(null);
    setAdjustingSlotId(null);
    autoWinTriggered.current = false;
    setWinner(null);
    setWinConfirmed(false);
    setDeathColors({});

    let counter = 0;
    const maxTicks = 10;

    const interval = setInterval(() => {
      const randomSlot =
        visibleSlots[Math.floor(Math.random() * visibleSlots.length)];
      setStartingPlayerId(randomSlot.id);
      counter++;

      if (counter >= maxTicks) {
        clearInterval(interval);
        const finalSlot =
          visibleSlots[Math.floor(Math.random() * visibleSlots.length)];
        setStartingPlayerId(finalSlot.id);
        setIsRolling(false);
      }
    }, 150);
  };

  // Logging a game IS recording the win — win totals are computed from the
  // games table server-side, so there's no separate counter to bump (and no
  // way for the two to double-count or drift).
  const confirmWin = async () => {
    if (!winner) return;
    if (!winner.player) {
      // This seat never had a profile linked, so there's nothing to record
      // a win against — just acknowledge it so the game can move on.
      setWinConfirmed(true);
      return;
    }
    try {
      const res = await fetch(`${BACKEND_URL}/games`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          winner_id: winner.player.id,
          winner_name: winner.player.name,
          player_count: playerCount,
        }),
      });
      if (res.ok) {
        await fetchGameHistory();
        await fetchPlayers();
        setWinConfirmed(true);
      }
    } catch (err) {
      console.error("Error recording match win:", err);
    }
  };

  // Opens the pending win screen for a slot — from the auto-detector or the
  // manual "Record Match Win" button. Nothing is written until confirmed.
  const openWinScreen = (slot) => {
    autoWinTriggered.current = true;
    setWinner(slot);
    setWinConfirmed(false);
    setActiveMenuSlot(null);
  };

  // Auto-win detection. Considers every SEAT in the pod, not just the ones
  // with a profile linked — a 4-player game with only 2 profiles loaded
  // still has 4 people playing, and eliminating one profiled player
  // shouldn't end the game while two unlinked seats are still alive.
  // Re-arms itself if players come back above 0 (e.g. after cancelling a
  // pending win and fixing a mis-tap).
  useEffect(() => {
    const currentVisible = slots.slice(0, playerCount);
    if (currentVisible.length < 2) return;
    const alive = currentVisible.filter((s) => s.life > 0 && !isLethalCmd(s));
    if (alive.length === 1 && !autoWinTriggered.current) {
      openWinScreen(alive[0]);
    } else if (alive.length > 1 && autoWinTriggered.current && !winner) {
      autoWinTriggered.current = false;
    }
  }, [slots, playerCount, winner]);

  // Random neon color per elimination, assigned once when a seat goes down
  // and cleared again once they're back above 0 — so it stays stable while
  // "GG" is showing, but the next elimination (for them or anyone else)
  // gets its own fresh random pick.
  const [deathColors, setDeathColors] = useState({});
  useEffect(() => {
    const currentVisible = slots.slice(0, playerCount);
    setDeathColors((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const s of currentVisible) {
        const dead = s.life <= 0 || isLethalCmd(s);
        if (dead && !next[s.id]) {
          next[s.id] =
            NEON_PALETTE[Math.floor(Math.random() * NEON_PALETTE.length)];
          changed = true;
        } else if (!dead && next[s.id]) {
          delete next[s.id];
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [slots, playerCount]);

  const getShortName = (slot) => {
    if (!slot) return "?";
    if (slot.player) {
      return slot.player.name.length <= 7
        ? slot.player.name
        : `${slot.player.name.substring(0, 6)}…`;
    }
    return `P${slot.id}`;
  };

  const getWinStreak = (playerId) => {
    if (!playerId || gameHistory.length === 0) return 0;
    let streak = 0;
    for (const game of gameHistory) {
      if (game.winner_id === playerId) streak++;
      else break;
    }
    return streak;
  };

  // SQLite timestamps are "YYYY-MM-DD HH:MM:SS" — Safari refuses to parse
  // that with a bare "Z" appended, so normalize to ISO-8601 first.
  const formatGameDate = (playedAt) => {
    if (!playedAt) return "";
    const d = new Date(playedAt.replace(" ", "T") + "Z");
    if (isNaN(d)) return playedAt;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getGridClasses = () => {
    if (playerCount === 2) return "grid-cols-1 grid-rows-2";
    if (playerCount === 5) return "grid-cols-2 grid-rows-3";
    return "grid-cols-2 grid-rows-2";
  };

  const lowHealthThreshold = Math.ceil(startingLife * 0.35);

  // Stats derived from history + players
  const podBreakdown = gameHistory.reduce((acc, g) => {
    acc[g.player_count] = (acc[g.player_count] || 0) + 1;
    return acc;
  }, {});
  const leaderboard = [...dbPlayers].sort(
    (a, b) => (b.wins || 0) - (a.wins || 0),
  );

  const winnerLifetimeWins = winner?.player
    ? (dbPlayers.find((p) => p.id === winner.player.id)?.wins ??
      winner.player.wins ??
      0)
    : 0;

  return (
    <div
      className={`fixed inset-0 grid bg-neutral-950 p-1 gap-1 select-none touch-none text-white overflow-hidden ${getGridClasses()}`}
    >
      {/* 1. PLAYERS GRID LAYOUT */}
      {(() => {
        const cmdDamageMode = activeCmdSlotId !== null;
        const cmdViewerIndex = cmdDamageMode
          ? visibleSlots.findIndex((s) => s.id === activeCmdSlotId)
          : -1;
        const cmdViewerSlot =
          cmdDamageMode && cmdViewerIndex >= 0
            ? visibleSlots[cmdViewerIndex]
            : null;
        // The viewer's own seat orientation — every opponent tile's damage
        // number/controls get counter-rotated to match THIS, not their own
        // native orientation, so they read right-side-up for whoever is
        // actually looking at them right now.
        const cmdViewerRotated = cmdViewerSlot
          ? !!layout.cells[cmdViewerIndex]?.rotated
          : false;
        return visibleSlots.map((slot, index) => {
        const seat = layout.cells[index];
        const isRotated = seat.rotated;
        const isSpannedRow = seat.span === 2;
        const displayName = slot.player ? slot.player.name : slot.label;
        const isStartingPlayer = startingPlayerId === slot.id;

        const lethalCommanderDamage = isLethalCmd(slot);
        const isDefeated = slot.life <= 0 || lethalCommanderDamage;
        // Commander-damage mode takes over every tile at once, so a defeat
        // overlay popping up mid-edit would just be in the way — suppress
        // it for the duration.
        const showDefeatOverlay =
          isDefeated && adjustingSlotId !== slot.id && !cmdDamageMode;

        // Commander-damage entry mode: tapping the mini-grid trigger on a
        // tile puts every OTHER tile into "how much damage has this player
        // dealt to the viewer" mode, in place — no separate popup needed.
        const isCmdViewerTile = cmdViewerSlot && slot.id === cmdViewerSlot.id;
        const isCmdTargetTile = cmdViewerSlot && !isCmdViewerTile;
        const cmdAmt = isCmdTargetTile
          ? cmdViewerSlot.commanderDamage[slot.id] || 0
          : 0;
        // This tile's own seat orientation differs from the viewer's, so
        // its damage number/controls need an extra local flip to read
        // right-side-up for the person actually looking at them.
        const cmdNeedsCounterRotate =
          isCmdTargetTile && seat.rotated !== cmdViewerRotated;

        const delta = lifeDeltas[slot.id];

        return (
          <div
            key={slot.id}
            className={`relative flex flex-col items-center justify-center rounded-2xl overflow-hidden border transition-all duration-500 bg-neutral-900 ${
              isStartingPlayer
                ? "border-yellow-500 shadow-[inset_0_0_20px_rgba(234,179,8,0.15)]"
                : "border-neutral-800"
            } ${isRotated ? "rotate-180" : ""} ${isSpannedRow ? "col-span-2" : ""}`}
          >
            {/* Background Art */}
            {slot.bgImage && (
              <div
                className={`absolute inset-0 bg-cover ${
                  playerCount === 2 ? "bg-center" : "bg-top"
                }`}
                style={{
                  backgroundImage: `url(${slot.bgImage})`,
                  filter: "brightness(0.75) contrast(1.15)",
                }}
              />
            )}

            {/* Overshield overlay — only once a player is meaningfully
                overhealed (10+ above starting life), not the moment they
                tick one point over. */}
            {slot.life > startingLife + 10 && (
              <div className="absolute inset-0 z-[1] pointer-events-none bg-emerald-400 animate-overshield rounded-2xl" />
            )}

            {/* Low health overlay (scales with starting life) */}
            {slot.life <= lowHealthThreshold && slot.life > 0 && (
              <div className="absolute inset-0 z-[1] pointer-events-none bg-red-600 animate-heartbeat rounded-2xl" />
            )}

            {isCmdTargetTile ? (
              // Commander-damage entry for this opponent, in place of their
              // normal life tap zones: tap = +1, long-press arms a -/+
              // split (same interaction the old popup used).
              <div
                className={`absolute inset-0 flex touch-none ${cmdNeedsCounterRotate ? "rotate-180" : ""}`}
              >
                {editingCmdSlot === slot.id ? (
                  <>
                    <div
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        updateCommanderDamage(cmdViewerSlot.id, slot.id, -1);
                      }}
                      className="w-1/2 h-full touch-none active:bg-red-500/20 flex items-center justify-center"
                    >
                      <span className="text-2xl font-black text-neutral-400">
                        −
                      </span>
                    </div>
                    <div
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        updateCommanderDamage(cmdViewerSlot.id, slot.id, 1);
                      }}
                      className="w-1/2 h-full touch-none active:bg-green-500/20 flex items-center justify-center"
                    >
                      <span className="text-2xl font-black text-neutral-400">
                        +
                      </span>
                    </div>
                  </>
                ) : (
                  <div
                    className="absolute inset-0 touch-none active:bg-white/10"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      const timer = setTimeout(
                        () => setEditingCmdSlot(slot.id),
                        500,
                      );
                      e.currentTarget.dataset.timer = timer;
                    }}
                    onPointerUp={(e) => {
                      e.stopPropagation();
                      clearTimeout(parseInt(e.currentTarget.dataset.timer));
                      if (editingCmdSlot !== slot.id)
                        updateCommanderDamage(cmdViewerSlot.id, slot.id, 1);
                    }}
                    onPointerLeave={(e) => {
                      clearTimeout(parseInt(e.currentTarget.dataset.timer));
                    }}
                  />
                )}
              </div>
            ) : isCmdViewerTile ? (
              // The viewer's own tile — tap anywhere to leave
              // commander-damage mode and go back to normal life view.
              <div
                className="absolute inset-0 touch-none active:bg-white/5"
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setActiveCmdSlotId(null);
                  setEditingCmdSlot(null);
                }}
              />
            ) : (
              <div className="absolute inset-0 flex">
              <div
                onPointerDown={(e) => {
                  e.stopPropagation();
                  pointerDownOnTapTarget.current[`${slot.id}-left`] = true;
                  const timer = setTimeout(() => {
                    updateLife(slot.id, -5);
                    showLifeDelta(slot.id, -5);
                    longPressRefs.current[`${slot.id}-left-interval`] =
                      setInterval(() => {
                        updateLife(slot.id, -5);
                        showLifeDelta(slot.id, -5);
                      }, 800);
                  }, 500);
                  longPressRefs.current[`${slot.id}-left-timer`] = timer;
                }}
                onPointerUp={(e) => {
                  if (!pointerDownOnTapTarget.current[`${slot.id}-left`])
                    return;
                  pointerDownOnTapTarget.current[`${slot.id}-left`] = false;
                  clearTimeout(longPressRefs.current[`${slot.id}-left-timer`]);
                  const interval =
                    longPressRefs.current[`${slot.id}-left-interval`];
                  if (interval) {
                    clearInterval(interval);
                    longPressRefs.current[`${slot.id}-left-interval`] = null;
                  } else {
                    updateLife(slot.id, -1);
                    showLifeDelta(slot.id, -1);
                  }
                }}
                onPointerLeave={(e) => {
                  pointerDownOnTapTarget.current[`${slot.id}-left`] = false;
                  clearTimeout(longPressRefs.current[`${slot.id}-left-timer`]);
                  clearInterval(
                    longPressRefs.current[`${slot.id}-left-interval`],
                  );
                  longPressRefs.current[`${slot.id}-left-interval`] = null;
                }}
                className="w-1/2 h-full touch-none active:bg-red-500/20 flex items-center justify-center"
              >
                <span className="text-2xl font-black text-neutral-400">−</span>
              </div>
              <div
                onPointerDown={(e) => {
                  e.stopPropagation();
                  pointerDownOnTapTarget.current[`${slot.id}-right`] = true;
                  const timer = setTimeout(() => {
                    updateLife(slot.id, 5);
                    showLifeDelta(slot.id, 5);
                    longPressRefs.current[`${slot.id}-right-interval`] =
                      setInterval(() => {
                        updateLife(slot.id, 5);
                        showLifeDelta(slot.id, 5);
                      }, 800);
                  }, 500);
                  longPressRefs.current[`${slot.id}-right-timer`] = timer;
                }}
                onPointerUp={(e) => {
                  if (!pointerDownOnTapTarget.current[`${slot.id}-right`])
                    return;
                  pointerDownOnTapTarget.current[`${slot.id}-right`] = false;
                  clearTimeout(longPressRefs.current[`${slot.id}-right-timer`]);
                  const interval =
                    longPressRefs.current[`${slot.id}-right-interval`];
                  if (interval) {
                    clearInterval(interval);
                    longPressRefs.current[`${slot.id}-right-interval`] = null;
                  } else {
                    updateLife(slot.id, 1);
                    showLifeDelta(slot.id, 1);
                  }
                }}
                onPointerLeave={(e) => {
                  pointerDownOnTapTarget.current[`${slot.id}-right`] = false;
                  clearTimeout(longPressRefs.current[`${slot.id}-right-timer`]);
                  clearInterval(
                    longPressRefs.current[`${slot.id}-right-interval`],
                  );
                  longPressRefs.current[`${slot.id}-right-interval`] = null;
                }}
                className="w-1/2 h-full touch-none active:bg-green-500/20 flex items-center justify-center"
              >
                <span className="text-2xl font-black text-neutral-400">+</span>
              </div>
              </div>
            )}

            <div
              className={`relative z-10 flex flex-col items-center justify-between h-full w-full pointer-events-none ${isCompact ? "p-1.5" : "p-3"}`}
            >
              <div className="flex justify-start w-full items-start pointer-events-none gap-2">
                {/* Tapping the name itself opens Slot Configuration — replaces
                    the old separate gear-icon button. */}
                <button
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setActiveMenuSlot(slot.id);
                  }}
                  className={`font-bold tracking-wide flex items-center gap-1.5 bg-black/50 rounded-full border pointer-events-auto active:scale-95 transition-all ${
                    isCompact ? "text-sm px-2.5 py-1" : "text-lg px-4 py-1.5"
                  } ${
                    isStartingPlayer
                      ? "border-yellow-500/50 text-yellow-400"
                      : "border-neutral-700/30 text-neutral-200"
                  }`}
                >
                  <User size={isCompact ? 14 : 17} /> {displayName}
                  {slot.player && getWinStreak(slot.player.id) >= 2 && (
                    <span className="text-sm">🔥</span>
                  )}
                  {monarchSlotId === slot.id && (
                    <span className="text-sm" title="Monarch">
                      👑
                    </span>
                  )}
                  {initiativeSlotId === slot.id && (
                    <span className="text-sm" title="Initiative">
                      ⚔️
                    </span>
                  )}
                </button>
              </div>

              <div className="flex flex-col items-center justify-center my-auto relative gap-1">
                {isCmdTargetTile ? (
                  <div
                    className={`flex flex-col items-center gap-1 ${cmdNeedsCounterRotate ? "rotate-180" : ""}`}
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400 bg-black/40 px-2 py-0.5 rounded-full">
                      Dealt to {getShortName(cmdViewerSlot)}
                    </span>
                    <span
                      className={`font-black tracking-tighter drop-shadow-[0_4px_24px_rgba(0,0,0,0.95)] tabular-nums text-7xl sm:text-8xl md:text-9xl ${cmdAmt > 0 ? "text-red-400" : "text-neutral-500"}`}
                      style={
                        isCompact
                          ? { fontSize: "clamp(2rem, 11vh, 6rem)", lineHeight: 1 }
                          : undefined
                      }
                    >
                      {cmdAmt}
                    </span>
                  </div>
                ) : isCmdViewerTile ? (
                  <>
                    <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500">
                      Viewing As
                    </span>
                    <span className="text-2xl font-bold text-neutral-300">
                      {displayName}
                    </span>
                    <span className="text-[10px] text-neutral-600 mt-1">
                      Tap anywhere to return
                    </span>
                  </>
                ) : (
                  <>
                    <span
                      className="font-black tracking-tighter drop-shadow-[0_4px_24px_rgba(0,0,0,0.95)] text-white tabular-nums text-7xl sm:text-8xl md:text-9xl"
                      style={
                        isCompact
                          ? { fontSize: "clamp(2rem, 11vh, 6rem)", lineHeight: 1 }
                          : undefined
                      }
                    >
                      {slot.life}
                    </span>
                    {delta && (
                      <span
                        className={`absolute -top-8 text-2xl font-black tabular-nums pointer-events-none
                          ${delta.amount > 0 ? "text-green-400" : "text-red-400"}
                          animate-bounce`}
                      >
                        {delta.amount > 0 ? `+${delta.amount}` : delta.amount}
                      </span>
                    )}
                  </>
                )}
              </div>

              {/* Commander damage mini-grid trigger — bottom-left, hidden
                  while commander-damage mode is already active elsewhere on
                  the board. Opens by putting every OTHER tile into damage
                  entry mode in place (see isCmdTargetTile above), no popup. */}
              {!cmdDamageMode && (
              <div className="w-full flex flex-col items-start gap-2 pointer-events-none">
                <div className="pointer-events-auto">
                  <button
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setActiveCmdSlotId(slot.id);
                    }}
                    className={`grid bg-black/40 rounded-xl border border-neutral-800/60 ${isCompact ? "gap-0.5 p-0.5" : "gap-1 p-1"}`}
                    style={{
                      gridTemplateColumns: `repeat(${layout.cols}, minmax(0, 1fr))`,
                    }}
                  >
                    {visibleSlots.map((opp, oppIndex) => {
                      const cell = getSeatCell(playerCount, oppIndex, index);
                      const cellStyle = {
                        gridRow: cell.row + 1,
                        gridColumn: `${cell.col + 1} / span ${cell.span}`,
                      };
                      if (opp.id === slot.id) {
                        return (
                          <div
                            key={`self-${opp.id}`}
                            style={{
                              ...cellStyle,
                              ...(isCompact
                                ? { height: "clamp(14px, 4.5vh, 40px)" }
                                : {}),
                            }}
                            className={`rounded-lg bg-neutral-950/20 border border-neutral-800/40 flex items-center justify-center ${isCompact ? "min-w-[3rem]" : "h-10 min-w-[5rem]"}`}
                          >
                            <span
                              className={`font-black text-neutral-600 uppercase tracking-widest ${isCompact ? "text-[8px]" : "text-[10px]"}`}
                            >
                              ME
                            </span>
                          </div>
                        );
                      }
                      const amt = slot.commanderDamage[opp.id] || 0;
                      return (
                        <div
                          key={opp.id}
                          style={{
                            ...cellStyle,
                            ...(isCompact
                              ? { height: "clamp(14px, 4.5vh, 40px)" }
                              : {}),
                          }}
                          className={`rounded-lg flex items-center justify-center border tabular-nums ${isCompact ? "min-w-[3rem]" : "h-10 min-w-[5rem]"} ${
                            amt > 0
                              ? "bg-red-950/60 border-red-700/50"
                              : "bg-neutral-900/70 border-neutral-800"
                          }`}
                        >
                          <span
                            className={`font-black ${isCompact ? "text-sm" : "text-xl"} ${amt > 0 ? "text-red-400" : "text-neutral-600"}`}
                          >
                            {amt}
                          </span>
                        </div>
                      );
                    })}
                  </button>
                </div>
              </div>
              )}
            </div>

            {/* Defeat overlay — covers the ENTIRE tile, header included.
                "Adjust Life" is the only way back to the controls
                underneath, so mis-taps can still be corrected. */}
            {showDefeatOverlay && (
              <div className="absolute inset-0 z-20 bg-black/80 flex flex-col items-center justify-center gap-3 select-none">
                <span
                  className={`font-black tracking-tighter animate-neon-flicker ${isCompact ? "text-6xl" : "text-8xl sm:text-9xl"}`}
                  style={{
                    color: "#fff",
                    textShadow: `0 0 4px #fff, 0 0 11px #fff, 0 0 19px ${(deathColors[slot.id] || NEON_PALETTE[0]).glow1}, 0 0 40px ${(deathColors[slot.id] || NEON_PALETTE[0]).glow1}, 0 0 80px ${(deathColors[slot.id] || NEON_PALETTE[0]).glow1}, 0 0 100px ${(deathColors[slot.id] || NEON_PALETTE[0]).glow2}`,
                  }}
                >
                  GG
                </span>
                <div className="flex flex-col items-center gap-1">
                  <span className="text-sm font-black uppercase tracking-widest text-red-500">
                    {lethalCommanderDamage ? "Commander Lethal" : "Defeated"}
                  </span>
                  {lethalCommanderDamage && slot.killedBySlotId && (
                    <span className="text-xs font-bold text-neutral-400 tracking-wide">
                      by{" "}
                      <span className="text-red-400">
                        {getShortName(
                          slots.find((s) => s.id === slot.killedBySlotId),
                        )}
                      </span>
                    </span>
                  )}
                </div>
                <button
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    clearTimeout(adjustTimerRef.current);
                    setAdjustingSlotId(slot.id);
                    adjustTimerRef.current = setTimeout(
                      () => setAdjustingSlotId(null),
                      6000,
                    );
                  }}
                  className="mt-1 text-xs font-bold uppercase tracking-wider text-neutral-300 bg-neutral-800/80 border border-neutral-700 px-4 py-1.5 rounded-full active:scale-95"
                >
                  Adjust Life
                </button>
              </div>
            )}
          </div>
        );
        });
      })()}

      {/* 2. CENTER CONTROL HUB TRIGGER BUTTON */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40">
        <button
          onPointerDown={() => setShowControlHub(true)}
          className="p-3 bg-neutral-900 border-2 border-neutral-700 hover:border-neutral-500 text-neutral-400 hover:text-white rounded-full shadow-[0_0_20px_rgba(0,0,0,0.75)] active:scale-90"
        >
          <Layers size={20} />
        </button>
      </div>

      {/* 3. GLOBAL MATCH CONTROL MODAL */}
      {showControlHub && (
        <div
          className="absolute inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onPointerDown={() => setShowControlHub(false)}
        >
          <div
            className="bg-neutral-900 border border-neutral-800 w-full max-w-lg rounded-2xl p-6 flex flex-col gap-5 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar overscroll-contain"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h2 className="text-xl font-bold text-neutral-200">
                Match Controls
              </h2>
              <button
                onClick={() => setShowControlHub(false)}
                className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white rounded-full transition-all"
              >
                <X size={18} />
              </button>
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider font-semibold text-neutral-400 block mb-2 flex items-center gap-1.5">
                <Users size={14} /> Pod Size
              </label>
              <div className="grid grid-cols-4 gap-2 bg-neutral-950 p-1.5 rounded-xl border border-neutral-800">
                {[2, 3, 4, 5].map((num) => (
                  <button
                    key={num}
                    onClick={() => {
                      setPlayerCount(num);
                      setStartingPlayerId(null);
                    }}
                    className={`py-2.5 rounded-lg font-bold text-sm transition-all ${
                      playerCount === num
                        ? "bg-blue-600 text-white"
                        : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900"
                    }`}
                  >
                    {num} P
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs uppercase tracking-wider font-semibold text-neutral-400 block mb-2 flex items-center gap-1.5">
                <Heart size={14} /> Starting Life{" "}
                <span className="normal-case font-normal text-neutral-600">
                  (applies on reset)
                </span>
              </label>
              <div className="grid grid-cols-3 gap-2 bg-neutral-950 p-1.5 rounded-xl border border-neutral-800">
                {[20, 30, 40].map((num) => (
                  <button
                    key={num}
                    onClick={() => setStartingLife(num)}
                    className={`py-2.5 rounded-lg font-bold text-sm transition-all ${
                      startingLife === num
                        ? "bg-blue-600 text-white"
                        : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900"
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  fetchGameHistory();
                  setShowHistory(true);
                }}
                className="py-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold rounded-xl flex items-center justify-center gap-2 text-base transition-all active:scale-95"
              >
                <Star size={18} className="text-yellow-500 fill-yellow-500" />
                History
              </button>
              <button
                onClick={() => {
                  fetchGameHistory();
                  fetchPlayers();
                  setShowStats(true);
                }}
                className="py-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold rounded-xl flex items-center justify-center gap-2 text-base transition-all active:scale-95"
              >
                <BarChart3 size={18} className="text-blue-400" />
                Stats
              </button>
            </div>

            <button
              onClick={() => {
                setShowControlHub(false);
                setShowCoinFlip(true);
                setCoinFlipResults([]);
                setDiceResults(null);
              }}
              className="w-full py-4 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold rounded-xl flex items-center justify-center gap-2 text-base transition-all active:scale-95"
            >
              🪙 Coin Flip & Dice
            </button>

            <button
              onClick={handleNewGameAndRoll}
              disabled={isRolling}
              className="w-full py-5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-base shadow-md active:scale-95 transition-all"
            >
              <Dices size={20} className={isRolling ? "animate-spin" : ""} />
              {isRolling ? "Rolling Turn One..." : "Reset & Roll First"}
            </button>
          </div>
        </div>
      )}

      {/* 4. SLOT PROFILE DRAWER */}
      {activeMenuSlot !== null && (
        <div
          className="absolute inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onPointerDown={() => setActiveMenuSlot(null)}
        >
          <div
            className="bg-neutral-900 border border-neutral-800 w-full max-w-2xl rounded-2xl p-6 flex flex-col gap-5 max-h-[94vh] overflow-y-auto no-scrollbar overscroll-contain shadow-2xl"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h2 className="text-xl font-bold text-neutral-100">
                Slot Configuration
              </h2>
              <div className="flex items-center gap-1.5">
                {/* Table status — compact icon toggles instead of a whole
                    separate labeled section. */}
                <button
                  title="Monarch"
                  onClick={() =>
                    setMonarchSlotId((m) =>
                      m === activeMenuSlot ? null : activeMenuSlot,
                    )
                  }
                  className={`p-2 text-base rounded-full border transition-all active:scale-95 ${
                    monarchSlotId === activeMenuSlot
                      ? "bg-yellow-600/30 border-yellow-500/60"
                      : "bg-neutral-950 border-neutral-800 hover:border-neutral-700"
                  }`}
                >
                  👑
                </button>
                <button
                  title="Initiative"
                  onClick={() =>
                    setInitiativeSlotId((m) =>
                      m === activeMenuSlot ? null : activeMenuSlot,
                    )
                  }
                  className={`p-2 text-base rounded-full border transition-all active:scale-95 ${
                    initiativeSlotId === activeMenuSlot
                      ? "bg-blue-600/30 border-blue-500/60"
                      : "bg-neutral-950 border-neutral-800 hover:border-neutral-700"
                  }`}
                >
                  ⚔️
                </button>
                <button
                  onClick={() => setActiveMenuSlot(null)}
                  className="p-1.5 ml-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white rounded-full transition-all"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {!activeMenuPlayer ? (
              <>
                <div>
                  <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                    Create New Profile
                  </h3>
                  <form onSubmit={handleCreatePlayer} className="flex gap-2">
                    <input
                      type="text"
                      value={newPlayerName}
                      onChange={(e) => setNewPlayerName(e.target.value)}
                      placeholder="Player Name"
                      className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-base outline-none focus:border-neutral-600 text-white"
                    />
                    <button
                      type="submit"
                      className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all"
                    >
                      <Plus size={20} />
                    </button>
                  </form>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                    Assign Profile to Slot{" "}
                    <span className="normal-case font-normal text-neutral-600">
                      (most played first)
                    </span>
                  </h3>
                  <div className="flex flex-col gap-2 max-h-[50vh] overflow-y-auto no-scrollbar overscroll-contain border border-neutral-800 bg-neutral-950/40 p-2 rounded-xl">
                    {dbPlayers.length === 0 ? (
                      <p className="text-sm text-neutral-500 text-center py-4">
                        No profiles found.
                      </p>
                    ) : (
                      [...dbPlayers]
                        .sort((a, b) => (b.wins || 0) - (a.wins || 0))
                        .map((p) => (
                          <div
                            key={p.id}
                            className="flex items-center gap-2 px-3 py-3 rounded-xl bg-neutral-800"
                          >
                            {renamingPlayerId === p.id ? (
                              <div className="flex flex-1 gap-1">
                                <input
                                  autoFocus
                                  value={renameValue}
                                  onChange={(e) =>
                                    setRenameValue(e.target.value)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter")
                                      handleRenamePlayer(p.id);
                                    if (e.key === "Escape") {
                                      setRenamingPlayerId(null);
                                      setRenameValue("");
                                    }
                                  }}
                                  className="flex-1 bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-1 text-base text-white outline-none"
                                />
                                <button
                                  onClick={() => handleRenamePlayer(p.id)}
                                  className="text-sm bg-blue-600 text-white font-bold px-3 py-1 rounded-lg"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => {
                                    setRenamingPlayerId(null);
                                    setRenameValue("");
                                  }}
                                  className="text-neutral-400 hover:text-white px-1"
                                >
                                  <X size={16} />
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  onClick={() =>
                                    assignPlayerToSlot(activeMenuSlot, p)
                                  }
                                  className="flex-1 flex justify-between items-center text-base text-neutral-200 hover:text-white"
                                >
                                  <span className="truncate">{p.name}</span>
                                  <span className="text-xs bg-neutral-900 px-2 py-1 rounded-md border border-neutral-700/50 text-amber-400 font-medium shrink-0 ml-2">
                                    🏆 {p.wins || 0}
                                  </span>
                                </button>
                                <button
                                  onClick={() => {
                                    setRenamingPlayerId(p.id);
                                    setRenameValue(p.name);
                                  }}
                                  className="p-2 text-neutral-500 hover:text-blue-400 rounded-lg hover:bg-neutral-700"
                                >
                                  <Settings size={16} />
                                </button>
                                <button
                                  onClick={() => handleDeletePlayer(p.id)}
                                  className="p-2 text-neutral-500 hover:text-red-400 rounded-lg hover:bg-neutral-700"
                                >
                                  <X size={16} />
                                </button>
                              </>
                            )}
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2 bg-neutral-950 p-3 border border-neutral-800 rounded-xl">
                  <div className="flex justify-between items-center border-b border-neutral-800/60 pb-2">
                    {renamingPlayerId === activeMenuPlayer.id ? (
                      <div className="flex flex-1 gap-1 mr-2">
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter")
                              handleRenamePlayer(activeMenuPlayer.id);
                            if (e.key === "Escape") {
                              setRenamingPlayerId(null);
                              setRenameValue("");
                            }
                          }}
                          className="flex-1 bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-0.5 text-sm text-white outline-none"
                        />
                        <button
                          onClick={() =>
                            handleRenamePlayer(activeMenuPlayer.id)
                          }
                          className="text-xs bg-blue-600 text-white font-bold px-2 py-1 rounded-lg"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setRenamingPlayerId(null);
                            setRenameValue("");
                          }}
                          className="text-neutral-400 px-1"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-xl font-bold text-blue-400">
                          {activeMenuPlayer.name}
                        </span>
                        <button
                          onClick={() => {
                            setRenamingPlayerId(activeMenuPlayer.id);
                            setRenameValue(activeMenuPlayer.name);
                          }}
                          className="p-1.5 text-neutral-500 hover:text-blue-400 rounded-lg hover:bg-neutral-800"
                        >
                          <Settings size={16} />
                        </button>
                      </div>
                    )}
                    <span className="text-sm text-amber-400 font-bold bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                      🏆 {activeMenuPlayer.wins || 0} Wins
                    </span>
                  </div>
                  <div className="flex justify-between items-center gap-2 pt-2">
                    <button
                      onClick={() => {
                        const slot = slots.find(
                          (s) => s.id === activeMenuSlot,
                        );
                        if (slot) openWinScreen(slot);
                      }}
                      className="text-sm bg-amber-600 hover:bg-amber-500 text-white font-bold px-4 py-2 rounded-lg shadow-md transition-all active:scale-95"
                    >
                      Record Match Win 🎉
                    </button>
                    <button
                      onClick={() =>
                        setSlots((prev) =>
                          prev.map((s) =>
                            s.id === activeMenuSlot
                              ? { ...s, player: null, bgImage: "" }
                              : s,
                          ),
                        )
                      }
                      className="flex items-center gap-1.5 text-xs font-bold text-neutral-300 bg-neutral-800 hover:bg-red-900/40 hover:text-red-400 border border-neutral-700 hover:border-red-800/60 px-3 py-2 rounded-lg transition-all active:scale-95"
                    >
                      <UserMinus size={13} />
                      Unlink
                    </button>
                  </div>
                </div>

                {/* Browsing existing favorites and adding new art are two
                    different jobs — splitting them into tabs instead of one
                    long stacked column is what actually fixes "scatterbrained". */}
                <div className="grid grid-cols-2 gap-1.5 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
                  <button
                    onClick={() => {
                      setDrawerTab("favorites");
                      setShowCustomUpload(false);
                    }}
                    className={`py-2 rounded-lg font-bold text-xs uppercase tracking-wide transition-all flex items-center justify-center gap-1.5 ${
                      drawerTab === "favorites"
                        ? "bg-blue-600 text-white"
                        : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900"
                    }`}
                  >
                    <Star size={13} /> Favorites
                  </button>
                  <button
                    onClick={() => {
                      setDrawerTab("add");
                      setArmedDeleteFavId(null);
                    }}
                    className={`py-2 rounded-lg font-bold text-xs uppercase tracking-wide transition-all flex items-center justify-center gap-1.5 ${
                      drawerTab === "add"
                        ? "bg-blue-600 text-white"
                        : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900"
                    }`}
                  >
                    <Plus size={13} /> Add New
                  </button>
                </div>

                {drawerTab === "favorites" && (
                  <div>
                  {playerFavorites.length === 0 ? (
                    <p className="text-xs text-neutral-600 italic py-1">
                      No favorited commanders yet.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto no-scrollbar overscroll-contain pr-0.5">
                      {playerFavorites.map((fav) => {
                        const isArmed = armedDeleteFavId === fav.id;
                        return (
                          <div
                            key={fav.id}
                            className={`relative group w-full pb-[66.6667%] gpu-layer rounded-xl overflow-hidden border transition-all select-none ${
                              isArmed
                                ? "border-red-500"
                                : "border-neutral-800 hover:border-yellow-500"
                            }`}
                            // Long press (500ms) arms this card for deletion
                            // instead of an always-visible X button. A short
                            // tap while armed confirms the delete; a short
                            // tap anywhere else dismisses the armed state
                            // and still performs its own normal action —
                            // same forgiving pattern as the rest of the app's
                            // press-and-hold controls (no confirm() dialog
                            // needed, the gesture itself is the confirmation).
                            // Also tracks how far the finger has moved since
                            // pointerdown: scrolling this grid means dragging
                            // across a card, and without this check that drag
                            // was being misread as either a tap-to-select
                            // (fast flick) or a long-press-to-arm (slow drag).
                            onPointerDown={(e) => {
                              favJustArmed.current = false;
                              e.currentTarget.dataset.dragged = "";
                              e.currentTarget.dataset.startX = e.clientX;
                              e.currentTarget.dataset.startY = e.clientY;
                              const timer = setTimeout(() => {
                                favJustArmed.current = true;
                                setArmedDeleteFavId(fav.id);
                              }, 500);
                              e.currentTarget.dataset.timer = timer;
                            }}
                            onPointerMove={(e) => {
                              const startX = parseFloat(
                                e.currentTarget.dataset.startX,
                              );
                              const startY = parseFloat(
                                e.currentTarget.dataset.startY,
                              );
                              if (Number.isNaN(startX) || Number.isNaN(startY))
                                return;
                              const moved = Math.hypot(
                                e.clientX - startX,
                                e.clientY - startY,
                              );
                              if (moved > 10) {
                                // The finger is scrolling the list, not
                                // tapping or holding this card — cancel the
                                // long-press arm and mark this gesture so the
                                // eventual pointerUp is ignored.
                                clearTimeout(
                                  parseInt(e.currentTarget.dataset.timer),
                                );
                                e.currentTarget.dataset.dragged = "1";
                              }
                            }}
                            onPointerUp={(e) => {
                              clearTimeout(parseInt(e.currentTarget.dataset.timer));
                              if (e.currentTarget.dataset.dragged === "1") {
                                favJustArmed.current = false;
                                return;
                              }
                              if (favJustArmed.current) {
                                // Tail end of the long-press gesture that just
                                // armed this card — not a new tap.
                                favJustArmed.current = false;
                                return;
                              }
                              if (isArmed) {
                                handleDeleteFavorite(fav.id);
                              } else {
                                if (armedDeleteFavId !== null)
                                  setArmedDeleteFavId(null);
                                handleSelectExistingFavorite(fav);
                              }
                            }}
                            onPointerLeave={(e) => {
                              clearTimeout(parseInt(e.currentTarget.dataset.timer));
                            }}
                          >
                            <img
                              src={resolveArt(fav.image_url)}
                              alt={fav.commander_name}
                              className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-all"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                            <span className="absolute bottom-1.5 left-1.5 right-1.5 text-xs font-bold truncate text-left">
                              {fav.commander_name}
                            </span>
                            {isArmed && (
                              <div className="absolute inset-0 bg-red-600/85 flex flex-col items-center justify-center gap-1">
                                <X size={22} className="text-white" />
                                <span className="text-[10px] font-bold uppercase tracking-wide text-white">
                                  Tap to Delete
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  </div>
                )}

                {drawerTab === "add" && (
                <div className="flex flex-col gap-4">
                  {/* Search is the primary, default way to add a commander —
                      simple and visual instead of a form full of fields. */}
                  <form onSubmit={handleScryfallSearch} className="flex gap-2">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search for a commander (e.g. Edgar Markov)"
                      className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3 text-base outline-none focus:border-neutral-600 text-white"
                    />
                    <button
                      type="submit"
                      className="px-5 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all"
                    >
                      {isSearching ? (
                        <Loader2 size={20} className="animate-spin" />
                      ) : (
                        <Search size={20} />
                      )}
                    </button>
                  </form>

                  {/* Printings picker — shown after tapping a search result
                      that has more than one printing, so a specific art can
                      be chosen instead of always saving whichever one
                      Scryfall's default search returned. */}
                  {printingsOptions ? (
                    <div>
                      <div className="flex items-center justify-between px-0.5 pb-2">
                        <span className="text-sm font-bold text-neutral-300">
                          Choose art for {printingsForName}
                        </span>
                        <button
                          onClick={() => setPrintingsOptions(null)}
                          className="p-1.5 text-neutral-500 hover:text-white rounded-full hover:bg-neutral-800"
                        >
                          <X size={16} />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-3 max-h-[55vh] overflow-y-auto no-scrollbar overscroll-contain pr-0.5">
                        {printingsOptions.map((print) => {
                          const img =
                            print.image_uris?.art_crop ||
                            print.card_faces?.[0]?.image_uris?.art_crop ||
                            "";
                          return (
                            <button
                              key={print.id}
                              onClick={() => handleSelectCommander(print)}
                              className="relative w-full pb-[66.6667%] gpu-layer rounded-xl overflow-hidden border border-neutral-800 hover:border-yellow-500 transition-all group"
                            >
                              {img && (
                                <img
                                  src={img}
                                  className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-all"
                                  alt={print.set_name || ""}
                                />
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/5 to-transparent" />
                              <span className="absolute bottom-1.5 left-1.5 right-1.5 text-xs font-bold truncate text-left">
                                {print.set_name}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    (searchResults.length > 0 || isLoadingPrintings) && (
                      <div className="grid grid-cols-2 gap-3 max-h-[55vh] overflow-y-auto no-scrollbar overscroll-contain pr-0.5">
                        {searchResults.map((card) => {
                          const img =
                            card.image_uris?.art_crop ||
                            card.card_faces?.[0]?.image_uris?.art_crop ||
                            "";
                          return (
                            <button
                              key={card.id}
                              disabled={isLoadingPrintings}
                              onClick={() => handleCardClick(card)}
                              className="relative w-full pb-[66.6667%] gpu-layer rounded-xl overflow-hidden border border-neutral-800 hover:border-yellow-500 transition-all group disabled:opacity-50"
                            >
                              {img && (
                                <img
                                  src={img}
                                  className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-all"
                                  alt=""
                                />
                              )}
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                              <span className="absolute bottom-1.5 left-1.5 right-1.5 text-xs font-bold truncate text-left">
                                {card.name}
                              </span>
                              {isLoadingPrintings && (
                                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                                  <Loader2
                                    size={22}
                                    className="animate-spin text-white"
                                  />
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    )
                  )}

                  {/* Custom art upload — a secondary path, tucked behind a
                      toggle so the default view stays simple: search first. */}
                  <div className="border-t border-neutral-800/60 pt-3">
                    {showCustomUpload ? (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                            Upload Custom Art
                          </h3>
                          <button
                            onClick={() => setShowCustomUpload(false)}
                            className="p-1 text-neutral-500 hover:text-white rounded-full hover:bg-neutral-800"
                          >
                            <X size={14} />
                          </button>
                        </div>
                        <form
                          onSubmit={async (e) => {
                            e.preventDefault();
                            const name =
                              e.target.elements.customName.value.trim();
                            const file =
                              e.target.elements.customFile.files[0];
                            if (!name || !file) return;
                            const currentSlot = slots.find(
                              (s) => s.id === activeMenuSlot,
                            );
                            const formData = new FormData();
                            formData.append("commander_name", name);
                            formData.append("image", file);
                            try {
                              const res = await fetch(
                                `${BACKEND_URL}/players/${currentSlot.player.id}/upload-favorite`,
                                { method: "POST", body: formData },
                              );
                              if (res.ok) {
                                const savedFavorite = await res.json();
                                e.target.reset();
                                fetchFavorites(currentSlot.player.id);
                                setSlots((prev) =>
                                  prev.map((s) =>
                                    s.id === activeMenuSlot
                                      ? {
                                          ...s,
                                          bgImage: resolveArt(
                                            savedFavorite.image_url,
                                          ),
                                          commanderName: name,
                                        }
                                      : s,
                                  ),
                                );
                                setActiveMenuSlot(null);
                              } else {
                                const errBody = await res
                                  .json()
                                  .catch(() => ({}));
                                alert(errBody.error || "Upload failed.");
                              }
                            } catch (err) {
                              console.error("Upload error:", err);
                            }
                          }}
                          className="flex flex-col gap-2"
                        >
                          <input
                            name="customName"
                            type="text"
                            placeholder="Commander Name (e.g., Watercolor Grimgrin)"
                            className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2 text-sm outline-none focus:border-neutral-600 text-white"
                            required
                          />
                          <div className="flex gap-2 items-center">
                            <input
                              name="customFile"
                              type="file"
                              accept="image/*"
                              className="flex-1 text-xs text-neutral-400 file:mr-2 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-neutral-800 file:text-neutral-200 cursor-pointer"
                              required
                            />
                            <button
                              type="submit"
                              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md"
                            >
                              Upload
                            </button>
                          </div>
                        </form>
                      </>
                    ) : (
                      <button
                        onClick={() => setShowCustomUpload(true)}
                        className="text-xs font-semibold text-neutral-500 hover:text-neutral-300 transition-colors"
                      >
                        + Upload your own custom art instead
                      </button>
                    )}
                  </div>
                </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 5. GAME HISTORY MODAL */}
      {showHistory && (
        <div
          className="absolute inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onPointerDown={() => setShowHistory(false)}
        >
          <div
            className="bg-neutral-900 border border-neutral-800 w-full max-w-sm rounded-2xl p-5 flex flex-col gap-4 max-h-[85vh] shadow-2xl"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <h2 className="text-lg font-bold text-neutral-200 flex items-center gap-2">
                <Star size={16} className="text-yellow-500 fill-yellow-500" />{" "}
                Game History
              </h2>
              <button
                onClick={() => setShowHistory(false)}
                className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white rounded-full transition-all"
              >
                <X size={16} />
              </button>
            </div>
            <div className="flex flex-col gap-2 overflow-y-auto no-scrollbar overscroll-contain">
              {gameHistory.length === 0 ? (
                <p className="text-sm text-neutral-500 text-center py-8 italic">
                  No games recorded yet.
                </p>
              ) : (
                gameHistory.map((game) => (
                  <div
                    key={game.id}
                    className="flex items-center justify-between bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3"
                  >
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-bold text-amber-400">
                        🏆 {game.winner_name}
                      </span>
                      <span className="text-[11px] text-neutral-500">
                        {game.player_count}P • {formatGameDate(game.played_at)}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteGameEntry(game.id)}
                      className="p-1.5 text-neutral-600 hover:text-red-400 hover:bg-neutral-800 rounded-lg transition-all"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 6. PLAYER STATS MODAL */}
      {showStats && (
        <div
          className="absolute inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onPointerDown={() => setShowStats(false)}
        >
          <div
            className="bg-neutral-900 border border-neutral-800 w-full max-w-sm rounded-2xl p-5 flex flex-col gap-4 max-h-[85vh] shadow-2xl overflow-y-auto no-scrollbar overscroll-contain"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <h2 className="text-lg font-bold text-neutral-200 flex items-center gap-2">
                <BarChart3 size={16} className="text-blue-400" /> Player Stats
              </h2>
              <button
                onClick={() => setShowStats(false)}
                className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white rounded-full transition-all"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex items-center justify-between bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-3">
              <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                Games Logged
              </span>
              <span className="text-2xl font-black text-white tabular-nums">
                {gameHistory.length}
              </span>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                Leaderboard
              </h3>
              <div className="flex flex-col gap-1.5">
                {leaderboard.length === 0 ? (
                  <p className="text-xs text-neutral-500 italic py-2">
                    No profiles yet.
                  </p>
                ) : (
                  leaderboard.map((p, i) => {
                    const streak = getWinStreak(p.id);
                    return (
                      <div
                        key={p.id}
                        className="flex items-center justify-between bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-neutral-600 w-5">
                            #{i + 1}
                          </span>
                          <span className="text-sm font-bold text-neutral-200">
                            {p.name}
                          </span>
                          {streak >= 2 && (
                            <span className="text-[10px] font-bold text-orange-400">
                              🔥 {streak}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-amber-400 font-bold tabular-nums">
                          🏆 {p.wins || 0}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {Object.keys(podBreakdown).length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                  Games by Pod Size
                </h3>
                <div className="grid grid-cols-4 gap-1.5">
                  {[2, 3, 4, 5].map((n) => (
                    <div
                      key={n}
                      className="flex flex-col items-center bg-neutral-950 border border-neutral-800 rounded-xl py-2"
                    >
                      <span className="text-[10px] font-bold text-neutral-500 uppercase">
                        {n}P
                      </span>
                      <span className="text-lg font-black text-white tabular-nums">
                        {podBreakdown[n] || 0}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 8. COIN FLIP & DICE MODAL */}
      {showCoinFlip && (
        <div
          className="absolute inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onPointerDown={() => setShowCoinFlip(false)}
        >
          <div
            className="bg-neutral-900 border border-neutral-800 w-full max-w-xs rounded-2xl p-5 flex flex-col gap-4 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar overscroll-contain"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <h2 className="text-lg font-bold text-neutral-200">
                🪙 Coin Flip & Dice
              </h2>
              <button
                onClick={() => setShowCoinFlip(false)}
                className="p-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white rounded-full transition-all"
              >
                <X size={16} />
              </button>
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wider font-semibold text-neutral-400 block mb-1.5">
                Count (coins or dice)
              </label>
              <div className="flex items-center gap-3 justify-center">
                <button
                  onClick={() => setCoinFlipCount((c) => Math.max(1, c - 1))}
                  className="w-10 h-10 bg-neutral-800 hover:bg-neutral-700 rounded-xl font-black text-xl text-neutral-200 active:scale-90 transition-all"
                >
                  −
                </button>
                <span className="text-3xl font-black text-white w-12 text-center tabular-nums">
                  {coinFlipCount}
                </span>
                <button
                  onClick={() => setCoinFlipCount((c) => Math.min(20, c + 1))}
                  className="w-10 h-10 bg-neutral-800 hover:bg-neutral-700 rounded-xl font-black text-xl text-neutral-200 active:scale-90 transition-all"
                >
                  +
                </button>
              </div>
            </div>

            <button
              onClick={() => {
                setIsFlipping(true);
                setCoinFlipResults([]);
                setDiceResults(null);
                setTimeout(() => {
                  const results = Array.from({ length: coinFlipCount }, () =>
                    Math.random() < 0.5 ? "heads" : "tails",
                  );
                  setCoinFlipResults(results);
                  setIsFlipping(false);
                }, 600);
              }}
              disabled={isFlipping || isRollingDice}
              className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 disabled:bg-neutral-800 text-white font-black rounded-xl flex items-center justify-center gap-2 text-sm shadow-md active:scale-95 transition-all"
            >
              {isFlipping
                ? "Flipping..."
                : `Flip ${coinFlipCount === 1 ? "1 Coin" : `${coinFlipCount} Coins`}`}
            </button>

            <div className="grid grid-cols-2 gap-2">
              {[6, 20].map((sides) => (
                <button
                  key={sides}
                  onClick={() => {
                    setIsRollingDice(true);
                    setCoinFlipResults([]);
                    setDiceResults(null);
                    setTimeout(() => {
                      const values = Array.from(
                        { length: coinFlipCount },
                        () => 1 + Math.floor(Math.random() * sides),
                      );
                      setDiceResults({ sides, values });
                      setIsRollingDice(false);
                    }, 600);
                  }}
                  disabled={isFlipping || isRollingDice}
                  className="py-3 bg-indigo-700 hover:bg-indigo-600 disabled:bg-neutral-800 text-white font-black rounded-xl flex items-center justify-center gap-2 text-sm shadow-md active:scale-95 transition-all"
                >
                  🎲 Roll d{sides}
                </button>
              ))}
            </div>

            {isRollingDice && (
              <p className="text-center text-xs text-neutral-500 animate-pulse">
                Rolling...
              </p>
            )}

            {coinFlipResults.length > 0 && !isFlipping && (
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-xs font-bold px-1">
                  <span className="text-yellow-400">
                    👑 Heads:{" "}
                    {coinFlipResults.filter((r) => r === "heads").length}
                  </span>
                  <span className="text-neutral-400">
                    Tails: {coinFlipResults.filter((r) => r === "tails").length}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto no-scrollbar overscroll-contain">
                  {coinFlipResults.map((result, i) => (
                    <div
                      key={i}
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-lg border-2 ${
                        result === "heads"
                          ? "bg-yellow-500/20 border-yellow-500/50"
                          : "bg-neutral-800 border-neutral-700"
                      }`}
                    >
                      {result === "heads" ? "👑" : "🌑"}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {diceResults && !isRollingDice && (
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-xs font-bold px-1">
                  <span className="text-indigo-300">
                    d{diceResults.sides} × {diceResults.values.length}
                  </span>
                  {diceResults.values.length > 1 && (
                    <span className="text-neutral-400">
                      Total: {diceResults.values.reduce((a, b) => a + b, 0)}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto no-scrollbar overscroll-contain">
                  {diceResults.values.map((v, i) => (
                    <div
                      key={i}
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black tabular-nums border-2 bg-indigo-500/20 border-indigo-500/50 text-white"
                    >
                      {v}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 9. WIN SCREEN — pending until confirmed, so nothing hits the
          database on an accidental tap. */}
      {winner && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center">
          {winner.bgImage && (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `url(${winner.bgImage})`,
                filter: "brightness(0.3) blur(8px) saturate(1.5)",
                transform: "scale(1.05)",
              }}
            />
          )}
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative z-10 flex flex-col items-center gap-6 px-8 text-center">
            <div className="text-6xl animate-bounce">👑</div>
            <div className="flex flex-col items-center gap-1">
              <span className="text-xs font-black uppercase tracking-[0.3em] text-yellow-400/80">
                {winConfirmed ? "Winner" : "Victory?"}
              </span>
              <span className="text-5xl font-black text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)]">
                {winner.player ? winner.player.name : getShortName(winner)}
              </span>
              {winner.commanderName && (
                <span className="text-sm font-bold text-neutral-400 uppercase tracking-widest mt-1">
                  {winner.commanderName}
                </span>
              )}
              {!winner.player && (
                <span className="text-[11px] font-bold text-neutral-500 uppercase tracking-widest mt-1">
                  No profile linked — win won't be recorded
                </span>
              )}
            </div>

            {winConfirmed ? (
              <>
                {winner.player && (
                  <span className="text-sm text-yellow-400 font-bold bg-yellow-500/10 border border-yellow-500/20 px-4 py-1.5 rounded-full">
                    🏆 {winnerLifetimeWins} lifetime wins
                  </span>
                )}
                <div className="flex flex-col gap-2 items-center">
                  <button
                    onClick={() => {
                      setShowControlHub(true);
                      setWinner(null);
                      setWinConfirmed(false);
                    }}
                    className="mt-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl text-sm shadow-xl active:scale-95 transition-all"
                  >
                    Reset & Roll Next Game
                  </button>
                  <button
                    onClick={() => {
                      setWinner(null);
                      setWinConfirmed(false);
                    }}
                    className="text-xs text-neutral-400 underline hover:text-white transition-colors"
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-2 items-center">
                <button
                  onClick={confirmWin}
                  className="px-8 py-3 bg-amber-600 hover:bg-amber-500 text-white font-black rounded-2xl text-sm shadow-xl active:scale-95 transition-all"
                >
                  Confirm Win 🏆
                </button>
                <button
                  onClick={() => {
                    // Cancel without recording anything. autoWinTriggered
                    // stays set and re-arms once more than one player is
                    // back above 0 (see the auto-win effect).
                    setWinner(null);
                    setWinConfirmed(false);
                  }}
                  className="text-xs text-neutral-400 underline hover:text-white transition-colors"
                >
                  Cancel — nothing recorded
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
