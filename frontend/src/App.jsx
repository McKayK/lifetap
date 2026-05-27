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
} from "lucide-react";

export default function App() {
  const [slots, setSlots] = useState([
    {
      id: 1,
      label: "Slot 1",
      player: null,
      life: 40,
      bgImage: "",
      commanderName: "",
      killedBySlotId: null,
      commanderDamage: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    },
    {
      id: 2,
      label: "Slot 2",
      player: null,
      life: 40,
      bgImage: "",
      commanderName: "",
      killedBySlotId: null,
      commanderDamage: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    },
    {
      id: 3,
      label: "Slot 3",
      player: null,
      life: 40,
      bgImage: "",
      commanderName: "",
      killedBySlotId: null,
      commanderDamage: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    },
    {
      id: 4,
      label: "Slot 4",
      player: null,
      life: 40,
      bgImage: "",
      commanderName: "",
      killedBySlotId: null,
      commanderDamage: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    },
    {
      id: 5,
      label: "Slot 5",
      player: null,
      life: 40,
      bgImage: "",
      commanderName: "",
      killedBySlotId: null,
      commanderDamage: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    },
  ]);

  const [playerCount, setPlayerCount] = useState(4);
  const [dbPlayers, setDbPlayers] = useState([]);
  const [activeMenuSlot, setActiveMenuSlot] = useState(null);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [activeCmdModifier, setActiveCmdModifier] = useState(null);
  const [renamingPlayerId, setRenamingPlayerId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [lifeHistory, setLifeHistory] = useState({});
  const [showHistory, setShowHistory] = useState(false);
  const [gameHistory, setGameHistory] = useState([]);
  const [turnCount, setTurnCount] = useState(1);
  const [editingCmdSlot, setEditingCmdSlot] = useState(null);

  const longPressRefs = useRef({});
  const pointerDownOnTapTarget = useRef({});

  const [lifeDeltas, setLifeDeltas] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [playerFavorites, setPlayerFavorites] = useState([]);
  const [showControlHub, setShowControlHub] = useState(false);
  const [startingPlayerId, setStartingPlayerId] = useState(null);
  const [isRolling, setIsRolling] = useState(false);

  // Coin flip state
  const [showCoinFlip, setShowCoinFlip] = useState(false);
  const [coinFlipCount, setCoinFlipCount] = useState(1);
  const [coinFlipResults, setCoinFlipResults] = useState([]);
  const [isFlipping, setIsFlipping] = useState(false);

  // Win screen state
  const [winner, setWinner] = useState(null);
  const autoWinTriggered = useRef(false);

  const BACKEND_URL = "https://life.mckaykleinman.com/api";

  const visibleSlots = slots.slice(0, playerCount);

  const fetchGameHistory = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/games`);
      const data = await res.json();
      setGameHistory(data);
    } catch (err) {
      console.error("Error fetching game history:", err);
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

  useEffect(() => {
    if (activeMenuSlot) {
      const currentSlot = slots.find((s) => s.id === activeMenuSlot);
      if (currentSlot && currentSlot.player) {
        fetchFavorites(currentSlot.player.id);
      } else {
        setPlayerFavorites([]);
      }
      setSearchQuery("");
      setSearchResults([]);
    }
  }, [activeMenuSlot, slots]);

  const fetchPlayers = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/players`);
      const data = await res.json();
      setDbPlayers(data);
    } catch (err) {
      console.error("Error fetching players:", err);
    }
  };

  const fetchFavorites = async (playerId) => {
    try {
      const res = await fetch(`${BACKEND_URL}/players/${playerId}/favorites`);
      const data = await res.json();
      setPlayerFavorites(data);
    } catch (err) {
      console.error("Error fetching favorites:", err);
    }
  };

  const handleLogGame = async (playerId, playerName) => {
    try {
      await fetch(`${BACKEND_URL}/games`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          winner_id: playerId,
          winner_name: playerName,
          player_count: playerCount,
          turns: turnCount,
        }),
      });
    } catch (err) {
      console.error("Error logging game:", err);
    }
  };

  const handleDeleteGameEntry = async (gameId) => {
    try {
      const res = await fetch(`${BACKEND_URL}/games/${gameId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      setGameHistory((prev) => prev.filter((g) => g.id !== gameId));
      if (data.winner_id) {
        setDbPlayers((prev) =>
          prev.map((p) =>
            p.id === data.winner_id
              ? { ...p, wins: Math.max(0, (p.wins || 0) - 1) }
              : p,
          ),
        );
        setSlots((prev) =>
          prev.map((s) =>
            s.player?.id === data.winner_id
              ? {
                  ...s,
                  player: {
                    ...s.player,
                    wins: Math.max(0, (s.player.wins || 0) - 1),
                  },
                }
              : s,
          ),
        );
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
        setSlots(
          slots.map((s) =>
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
        setSlots(
          slots.map((s) =>
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
      setSlots(
        slots.map((s) =>
          s.id === activeMenuSlot
            ? { ...s, bgImage: image_url, commanderName: card.name }
            : s,
        ),
      );
      setActiveMenuSlot(null);
    } catch (err) {
      console.error("Error saving favorite:", err);
    }
  };

  const handleSelectExistingFavorite = (imageUrl) => {
    const fav = playerFavorites.find((f) => f.image_url === imageUrl);
    setSlots(
      slots.map((s) =>
        s.id === activeMenuSlot
          ? {
              ...s,
              bgImage: imageUrl,
              commanderName: fav?.commander_name || "Commander",
            }
          : s,
      ),
    );
    setActiveMenuSlot(null);
  };

  const assignPlayerToSlot = (slotId, playerObj) => {
    setSlots(
      slots.map((s) =>
        s.id === slotId ? { ...s, player: playerObj, bgImage: "" } : s,
      ),
    );
  };

  const showLifeDelta = (id, amount) => {
    setLifeDeltas((prev) => {
      const existing = prev[id];
      if (existing?.timeoutId) clearTimeout(existing.timeoutId);
      const newTotal = (existing?.amount ?? 0) + amount;
      const timeoutId = setTimeout(() => {
        setLifeDeltas((p) => {
          const next = { ...p };
          delete next[id];
          return next;
        });
      }, 5000);
      return { ...prev, [id]: { amount: newTotal, timeoutId } };
    });
  };

  const updateLife = (id, amount) => {
    setSlots((prev) => {
      const slot = prev.find((s) => s.id === id);
      setLifeHistory((h) => ({
        ...h,
        [id]: [...(h[id] || []), slot.life],
      }));
      return prev.map((s) =>
        s.id === id ? { ...s, life: s.life + amount } : s,
      );
    });
  };

  const updateCommanderDamage = (targetSlotId, opponentSlotId, amount) => {
    setSlots(
      slots.map((s) => {
        if (s.id === targetSlotId) {
          const currentDamage = s.commanderDamage[opponentSlotId] || 0;
          const newDamage = Math.max(0, currentDamage + amount);
          const isNowLethal = newDamage >= 21;
          return {
            ...s,
            life: s.life - amount,
            commanderDamage: {
              ...s.commanderDamage,
              [opponentSlotId]: newDamage,
            },
            killedBySlotId: isNowLethal ? opponentSlotId : s.killedBySlotId,
          };
        }
        return s;
      }),
    );
    showLifeDelta(targetSlotId, -amount);
  };

  const handleNewGameAndRoll = () => {
    setShowControlHub(false);
    setSlots(
      slots.map((s) => ({
        ...s,
        life: 40,
        commanderDamage: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        killedBySlotId: null,
      })),
    );
    setStartingPlayerId(null);
    setIsRolling(true);
    setLifeHistory({});
    setLifeDeltas({});
    setTurnCount(1);
    autoWinTriggered.current = false;
    setWinner(null);

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

  const handleRecordWin = async (playerId) => {
    try {
      const res = await fetch(`${BACKEND_URL}/players/${playerId}/win`, {
        method: "POST",
      });
      if (res.ok) {
        const winnerSlot = slots.find((s) => s.player?.id === playerId)?.player;
        await handleLogGame(playerId, winnerSlot?.name || "Unknown");
        fetchPlayers();
        fetchGameHistory();
        setSlots(
          slots.map((s) => {
            if (s.player && s.player.id === playerId) {
              return {
                ...s,
                player: { ...s.player, wins: (s.player.wins || 0) + 1 },
              };
            }
            return s;
          }),
        );
        setActiveMenuSlot(null);
      }
    } catch (err) {
      console.error("Error recording match win:", err);
    }
  };

  // Auto-win: placed after handleRecordWin so it can call it directly
  useEffect(() => {
    if (autoWinTriggered.current) return;
    const currentVisible = slots.slice(0, playerCount);
    const activePlayers = currentVisible.filter((s) => s.player);
    if (activePlayers.length < 2) return;
    const alive = activePlayers.filter((s) => {
      const lethalCmd = Object.values(s.commanderDamage).some(
        (dmg) => dmg >= 21,
      );
      return s.life > 0 && !lethalCmd;
    });
    if (alive.length === 1) {
      autoWinTriggered.current = true;
      setWinner(alive[0]);
      handleRecordWin(alive[0].player.id);
    }
  }, [slots, playerCount]);

  const getActiveSlotPlayer = () =>
    slots.find((s) => s.id === activeMenuSlot)?.player;

  const getGridClasses = () => {
    if (playerCount === 2) return "grid-cols-1 grid-rows-2";
    if (playerCount === 5) return "grid-cols-2 grid-rows-3";
    return "grid-cols-2 grid-rows-2";
  };

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

  const getCmdDamageGridOrder = (slot) => {
    const allIds = Array.from({ length: playerCount }, (_, i) => i + 1);
    const index = visibleSlots.indexOf(slot);
    const isRotated = playerCount === 2 ? index === 0 : index < 2;
    return isRotated ? [...allIds].reverse() : allIds;
  };

  return (
    <div
      className={`h-screen w-screen grid bg-neutral-950 p-1 gap-1 select-none text-white relative overflow-hidden ${getGridClasses()}`}
    >
      {/* 1. PLAYERS GRID LAYOUT */}
      {visibleSlots.map((slot, index) => {
        const isRotated = playerCount === 2 ? index === 0 : index < 2;
        const displayName = slot.player ? slot.player.name : slot.label;
        const isStartingPlayer = startingPlayerId === slot.id;
        const isSpannedRow =
          (playerCount === 3 && index === 2) ||
          (playerCount === 5 && index === 4);

        const lethalCommanderDamage = Object.values(slot.commanderDamage).some(
          (dmg) => dmg >= 21,
        );
        const isDefeated = slot.life <= 0 || lethalCommanderDamage;

        const delta = lifeDeltas[slot.id];
        const cmdOrder = getCmdDamageGridOrder(slot);

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

            {/* Overshield overlay */}
            {slot.life > 40 && (
              <div className="absolute inset-0 z-[1] pointer-events-none bg-emerald-400 animate-overshield rounded-2xl" />
            )}

            {/* Low health overlay */}
            {slot.life <= 15 && slot.life > 0 && (
              <div className="absolute inset-0 z-[1] pointer-events-none bg-red-600 animate-heartbeat rounded-2xl" />
            )}

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
                className="w-1/2 h-full active:bg-red-500/20 flex items-center justify-center"
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
                className="w-1/2 h-full active:bg-green-500/20 flex items-center justify-center"
              >
                <span className="text-2xl font-black text-neutral-400">+</span>
              </div>
            </div>

            <div className="relative z-10 flex flex-col items-center justify-between h-full w-full p-3 pointer-events-none">
              <div className="flex justify-between w-full items-start pointer-events-none gap-2">
                <div className="flex flex-col gap-1 items-start pointer-events-none">
                  <span
                    className={`font-bold text-sm tracking-wide flex items-center gap-1 bg-black/50 px-3 py-1 rounded-full border ${
                      isStartingPlayer
                        ? "border-yellow-500/50 text-yellow-400"
                        : "border-neutral-700/30 text-neutral-200"
                    }`}
                  >
                    <User size={13} /> {displayName}
                    {slot.player && getWinStreak(slot.player.id) >= 2 && (
                      <span className="text-sm">🔥</span>
                    )}
                  </span>
                </div>

                <button
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setActiveMenuSlot(slot.id);
                  }}
                  className={`p-3 bg-black/50 border rounded-full transition-all flex-shrink-0 pointer-events-auto ${
                    isStartingPlayer
                      ? "border-yellow-500/30 text-yellow-500/70"
                      : "border-neutral-700/30 text-neutral-400"
                  }`}
                >
                  <Settings size={20} />
                </button>
              </div>

              <div className="flex flex-col items-center justify-center my-auto relative">
                <span className="text-7xl sm:text-8xl md:text-9xl font-black tracking-tighter drop-shadow-[0_4px_24px_rgba(0,0,0,0.95)] text-white tabular-nums">
                  {slot.life}
                </span>
                {delta && (
                  <span
                    key={delta.amount}
                    className={`absolute -top-8 text-2xl font-black tabular-nums pointer-events-none
                      ${delta.amount > 0 ? "text-green-400" : "text-red-400"}
                      animate-bounce`}
                  >
                    {delta.amount > 0 ? `+${delta.amount}` : delta.amount}
                  </span>
                )}
              </div>

              <div className="w-full flex flex-col items-center gap-2 pointer-events-none">
                <div className="pointer-events-auto">
                  <button
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setActiveCmdModifier({
                        targetSlotId: slot.id,
                        opponentSlotId: null,
                      });
                    }}
                    className="grid grid-cols-2 gap-1 bg-black/40 p-1 rounded-xl border border-neutral-800/60"
                  >
                    {cmdOrder.map((oppId) => {
                      const opp = slots.find((s) => s.id === oppId);
                      if (!opp) return null;
                      if (opp.id === slot.id) {
                        return (
                          <div
                            key={`self-${opp.id}`}
                            className="h-10 w-20 rounded-lg bg-neutral-950/20 border border-neutral-800/40 flex items-center justify-center"
                          >
                            <span className="text-[10px] font-black text-neutral-600 uppercase tracking-widest">
                              ME
                            </span>
                          </div>
                        );
                      }
                      const isOpponentInGame = opp.id <= playerCount;
                      const amt = slot.commanderDamage[opp.id] || 0;
                      return (
                        <div
                          key={opp.id}
                          className={`h-10 w-20 rounded-lg flex items-center justify-center border tabular-nums ${
                            !isOpponentInGame
                              ? "bg-neutral-950/40 border-neutral-900/30 opacity-20"
                              : amt > 0
                                ? "bg-red-950/60 border-red-700/50"
                                : "bg-neutral-900/70 border-neutral-800"
                          }`}
                        >
                          <span
                            className={`text-xl font-black ${amt > 0 ? "text-red-400" : "text-neutral-600"}`}
                          >
                            {isOpponentInGame ? amt : ""}
                          </span>
                        </div>
                      );
                    })}
                  </button>
                </div>
              </div>
            </div>

            {isDefeated && (
              <div className="absolute inset-0 z-20 bg-black/60 flex flex-col items-center justify-center gap-1 pointer-events-none select-none">
                <span className="text-5xl opacity-90">💀</span>
                <span className="text-xs font-black uppercase tracking-widest text-red-500">
                  {lethalCommanderDamage ? "Commander Lethal" : "Defeated"}
                </span>
                {lethalCommanderDamage && slot.killedBySlotId && (
                  <span className="text-[11px] font-bold text-neutral-400 tracking-wide mt-0.5">
                    by{" "}
                    <span className="text-red-400">
                      {getShortName(
                        slots.find((s) => s.id === slot.killedBySlotId),
                      )}
                    </span>
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}

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
            className="bg-neutral-900 border border-neutral-800 w-full max-w-xs rounded-2xl p-5 flex flex-col gap-4 shadow-2xl"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <h2 className="text-lg font-bold text-neutral-200">
                Match Controls
              </h2>
              <button
                onClick={() => setShowControlHub(false)}
                className="p-1 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white rounded-full transition-all"
              >
                <X size={16} />
              </button>
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wider font-semibold text-neutral-400 block mb-1.5 flex items-center gap-1">
                <Users size={12} /> Pod Size
              </label>
              <div className="grid grid-cols-4 gap-1.5 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
                {[2, 3, 4, 5].map((num) => (
                  <button
                    key={num}
                    onClick={() => {
                      setPlayerCount(num);
                      setStartingPlayerId(null);
                    }}
                    className={`py-1.5 rounded-lg font-bold text-xs transition-all ${
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

            <button
              onClick={() => {
                fetchGameHistory();
                setShowHistory(true);
              }}
              className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold rounded-xl flex items-center justify-center gap-2 text-sm transition-all active:scale-95"
            >
              <Star size={16} className="text-yellow-500 fill-yellow-500" />{" "}
              Game History
            </button>

            <button
              onClick={() => {
                setShowControlHub(false);
                setShowCoinFlip(true);
                setCoinFlipResults([]);
              }}
              className="w-full py-3 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-bold rounded-xl flex items-center justify-center gap-2 text-sm transition-all active:scale-95"
            >
              🪙 Coin Flip
            </button>

            <button
              onClick={handleNewGameAndRoll}
              disabled={isRolling}
              className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-neutral-800 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm shadow-md active:scale-95 transition-all"
            >
              <Dices size={18} className={isRolling ? "animate-spin" : ""} />
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
            className="bg-neutral-900 border border-neutral-800 w-full max-w-md rounded-2xl p-6 flex flex-col gap-5 max-h-[90vh] overflow-y-auto shadow-2xl"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h2 className="text-xl font-bold text-neutral-100">
                Slot Configuration
              </h2>
              <button
                onClick={() => setActiveMenuSlot(null)}
                className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-400 hover:text-white rounded-full transition-all"
              >
                <X size={18} />
              </button>
            </div>

            {!getActiveSlotPlayer() ? (
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
                      className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-sm outline-none focus:border-neutral-600 text-white"
                    />
                    <button
                      type="submit"
                      className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all"
                    >
                      <Plus size={18} />
                    </button>
                  </form>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                    Assign Profile to Slot
                  </h3>
                  <div className="flex flex-col gap-1 max-h-[180px] overflow-y-auto border border-neutral-800 bg-neutral-950/40 p-1 rounded-xl">
                    {dbPlayers.length === 0 ? (
                      <p className="text-xs text-neutral-500 text-center py-4">
                        No profiles found.
                      </p>
                    ) : (
                      dbPlayers.map((p) => (
                        <div
                          key={p.id}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-neutral-800"
                        >
                          {renamingPlayerId === p.id ? (
                            <div className="flex flex-1 gap-1">
                              <input
                                autoFocus
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter")
                                    handleRenamePlayer(p.id);
                                  if (e.key === "Escape") {
                                    setRenamingPlayerId(null);
                                    setRenameValue("");
                                  }
                                }}
                                className="flex-1 bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-0.5 text-sm text-white outline-none"
                              />
                              <button
                                onClick={() => handleRenamePlayer(p.id)}
                                className="text-xs bg-blue-600 text-white font-bold px-2 py-0.5 rounded-lg"
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
                                <X size={14} />
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                onClick={() =>
                                  assignPlayerToSlot(activeMenuSlot, p)
                                }
                                className="flex-1 flex justify-between items-center text-sm text-neutral-200 hover:text-white"
                              >
                                <span>{p.name}</span>
                                <span className="text-xs bg-neutral-900 px-2 py-0.5 rounded-md border border-neutral-700/50 text-amber-400 font-medium">
                                  🏆 {p.wins || 0}
                                </span>
                              </button>
                              <button
                                onClick={() => {
                                  setRenamingPlayerId(p.id);
                                  setRenameValue(p.name);
                                }}
                                className="p-1.5 text-neutral-500 hover:text-blue-400 rounded-lg hover:bg-neutral-700"
                              >
                                <Settings size={13} />
                              </button>
                              <button
                                onClick={() => handleDeletePlayer(p.id)}
                                className="p-1.5 text-neutral-500 hover:text-red-400 rounded-lg hover:bg-neutral-700"
                              >
                                <X size={13} />
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
                    {renamingPlayerId === getActiveSlotPlayer().id ? (
                      <div className="flex flex-1 gap-1 mr-2">
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter")
                              handleRenamePlayer(getActiveSlotPlayer().id);
                            if (e.key === "Escape") {
                              setRenamingPlayerId(null);
                              setRenameValue("");
                            }
                          }}
                          className="flex-1 bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-0.5 text-sm text-white outline-none"
                        />
                        <button
                          onClick={() =>
                            handleRenamePlayer(getActiveSlotPlayer().id)
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
                        <span className="text-sm font-bold text-blue-400">
                          {getActiveSlotPlayer().name}
                        </span>
                        <button
                          onClick={() => {
                            setRenamingPlayerId(getActiveSlotPlayer().id);
                            setRenameValue(getActiveSlotPlayer().name);
                          }}
                          className="p-1 text-neutral-500 hover:text-blue-400 rounded-lg hover:bg-neutral-800"
                        >
                          <Settings size={13} />
                        </button>
                      </div>
                    )}
                    <span className="text-xs text-amber-400 font-bold bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
                      🏆 {getActiveSlotPlayer().wins || 0} Wins
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1">
                    <button
                      onClick={() => handleRecordWin(getActiveSlotPlayer().id)}
                      className="text-xs bg-amber-600 hover:bg-amber-500 text-white font-bold px-3 py-1.5 rounded-lg shadow-md transition-all active:scale-95"
                    >
                      Record Match Win 🎉
                    </button>
                    <button
                      onClick={() =>
                        setSlots(
                          slots.map((s) =>
                            s.id === activeMenuSlot
                              ? { ...s, player: null, bgImage: "" }
                              : s,
                          ),
                        )
                      }
                      className="text-xs text-neutral-400 underline hover:text-red-400 transition-colors"
                    >
                      Unlink Profile
                    </button>
                  </div>
                </div>

                <div>
                  <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Star
                      size={12}
                      className="text-yellow-500 fill-yellow-500"
                    />{" "}
                    Favorites List
                  </h3>
                  <div className="flex gap-2 overflow-x-auto pb-2">
                    {playerFavorites.length === 0 ? (
                      <p className="text-xs text-neutral-600 italic py-1">
                        No favorited commanders yet.
                      </p>
                    ) : (
                      playerFavorites.map((fav) => (
                        <button
                          key={fav.id}
                          onClick={() =>
                            handleSelectExistingFavorite(fav.image_url)
                          }
                          className="flex-shrink-0 relative group h-14 w-24 rounded-lg overflow-hidden border border-neutral-800 hover:border-yellow-500 transition-all"
                        >
                          <img
                            src={fav.image_url}
                            alt={fav.commander_name}
                            className="h-full w-full object-cover brightness-70 group-hover:scale-105 transition-all"
                          />
                          <div className="absolute inset-0 bg-black/40 flex items-end p-1">
                            <span className="text-[10px] font-bold truncate block w-full text-left">
                              {fav.commander_name}
                            </span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div className="border-t border-neutral-800/60 pt-3">
                  <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                    Upload Custom Proxy Art
                  </h3>
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const name = e.target.elements.customName.value.trim();
                      const file = e.target.elements.customFile.files[0];
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
                          setSlots(
                            slots.map((s) =>
                              s.id === activeMenuSlot
                                ? {
                                    ...s,
                                    bgImage: savedFavorite.image_url,
                                    commanderName: name,
                                  }
                                : s,
                            ),
                          );
                          setActiveMenuSlot(null);
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
                      className="bg-neutral-950 border border-neutral-800 rounded-xl px-3 py-1.5 text-xs outline-none focus:border-neutral-600 text-white"
                      required
                    />
                    <div className="flex gap-2 items-center">
                      <input
                        name="customFile"
                        type="file"
                        accept="image/*"
                        className="flex-1 text-xs text-neutral-400 file:mr-2 file:py-1 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-neutral-800 file:text-neutral-200 cursor-pointer"
                        required
                      />
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl shadow-md"
                      >
                        Upload
                      </button>
                    </div>
                  </form>
                </div>

                <div className="border-t border-neutral-800/60 pt-3">
                  <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                    Search Scryfall Art
                  </h3>
                  <form onSubmit={handleScryfallSearch} className="flex gap-2">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="e.g. Edgar Markov"
                      className="flex-1 bg-neutral-950 border border-neutral-800 rounded-xl px-4 py-2 text-sm outline-none focus:border-neutral-600 text-white"
                    />
                    <button
                      type="submit"
                      className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all"
                    >
                      {isSearching ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <Search size={18} />
                      )}
                    </button>
                  </form>
                </div>

                {searchResults.length > 0 && (
                  <div className="border border-neutral-800 bg-neutral-950 p-2 rounded-xl max-h-[150px] overflow-y-auto flex flex-col gap-1">
                    {searchResults.map((card) => {
                      const img =
                        card.image_uris?.art_crop ||
                        card.card_faces?.[0]?.image_uris?.art_crop ||
                        "";
                      return (
                        <button
                          key={card.id}
                          onClick={() => handleSelectCommander(card)}
                          className="w-full flex items-center gap-3 p-1.5 hover:bg-neutral-800/60 rounded-lg text-left group"
                        >
                          {img && (
                            <img
                              src={img}
                              className="h-9 w-12 object-cover rounded-md border border-neutral-800"
                              alt=""
                            />
                          )}
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-neutral-200 group-hover:text-white">
                              {card.name}
                            </span>
                            <span className="text-[10px] text-neutral-500">
                              {card.type_line}
                            </span>
                          </div>
                        </button>
                      );
                    })}
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
            <div className="flex flex-col gap-2 overflow-y-auto">
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
                        {game.player_count}P • T{game.turns} •{" "}
                        {new Date(game.played_at + "Z").toLocaleDateString(
                          "en-US",
                          { month: "short", day: "numeric", year: "numeric" },
                        )}
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

      {/* 6. COMMANDER DAMAGE POPUP */}
      {activeCmdModifier &&
        (() => {
          const targetSlot = slots.find(
            (s) => s.id === activeCmdModifier.targetSlotId,
          );
          if (!targetSlot) return null;
          const allIds = Array.from({ length: playerCount }, (_, i) => i + 1);
          const cmdOrder = targetSlot.id <= 2 ? [...allIds].reverse() : allIds;
          return (
            <div
              className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center"
              onPointerDown={(e) => {
                e.stopPropagation();
                setActiveCmdModifier(null);
                setEditingCmdSlot(null);
              }}
            >
              <div
                className={`grid grid-cols-2 gap-3 p-4 w-[90vw] max-w-sm ${targetSlot.id <= 2 ? "rotate-180" : ""}`}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {cmdOrder.map((oppId) => {
                  const opp = slots.find((s) => s.id === oppId);
                  if (!opp) return null;

                  if (opp.id === targetSlot.id) {
                    return (
                      <div
                        key={`self-${opp.id}`}
                        className="h-32 rounded-2xl bg-neutral-950/60 border-2 border-neutral-800 flex items-center justify-center"
                      >
                        <span className="text-lg font-black text-neutral-600 uppercase tracking-widest">
                          ME
                        </span>
                      </div>
                    );
                  }

                  const isOpponentInGame = opp.id <= playerCount;
                  const amt = targetSlot.commanderDamage[opp.id] || 0;

                  if (!isOpponentInGame) {
                    return (
                      <div
                        key={opp.id}
                        className="h-32 rounded-2xl bg-neutral-950/40 border-2 border-neutral-900/30 opacity-20"
                      />
                    );
                  }

                  return (
                    <div
                      key={opp.id}
                      className={`h-32 rounded-2xl border-2 flex flex-col items-center justify-center relative overflow-hidden ${amt > 0 ? "border-red-700/50" : "border-neutral-700"}`}
                    >
                      {opp.bgImage ? (
                        <div
                          className="absolute inset-0 bg-cover bg-top"
                          style={{
                            backgroundImage: `url(${opp.bgImage})`,
                            filter:
                              amt > 0
                                ? "brightness(0.65) contrast(1.2) sepia(0.4)"
                                : "brightness(0.55) contrast(1.1)",
                          }}
                        />
                      ) : (
                        <div
                          className={`absolute inset-0 ${amt > 0 ? "bg-red-950/40" : "bg-neutral-900"}`}
                        />
                      )}
                      <span className="absolute top-2 left-0 right-0 text-center text-[10px] font-black uppercase tracking-widest text-white/60 z-10 px-1 truncate">
                        {getShortName(opp)}
                      </span>
                      <span
                        className={`text-4xl font-black tabular-nums pointer-events-none z-10 drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] ${amt > 0 ? "text-red-400" : "text-neutral-400"}`}
                      >
                        {amt}
                      </span>
                      <div className="absolute inset-0 flex">
                        {editingCmdSlot === opp.id ? (
                          <>
                            <div
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                updateCommanderDamage(
                                  targetSlot.id,
                                  opp.id,
                                  -1,
                                );
                              }}
                              className="w-1/2 h-full active:bg-red-500/20 flex items-center justify-center"
                            >
                              <span className="text-2xl font-black text-neutral-400">
                                −
                              </span>
                            </div>
                            <div
                              onPointerDown={(e) => {
                                e.stopPropagation();
                                updateCommanderDamage(targetSlot.id, opp.id, 1);
                              }}
                              className="w-1/2 h-full active:bg-green-500/20 flex items-center justify-center"
                            >
                              <span className="text-2xl font-black text-neutral-400">
                                +
                              </span>
                            </div>
                          </>
                        ) : (
                          <div
                            className="absolute inset-0 active:bg-white/10"
                            onPointerDown={(e) => {
                              e.stopPropagation();
                              const timer = setTimeout(
                                () => setEditingCmdSlot(opp.id),
                                500,
                              );
                              e.currentTarget.dataset.timer = timer;
                            }}
                            onPointerUp={(e) => {
                              e.stopPropagation();
                              clearTimeout(
                                parseInt(e.currentTarget.dataset.timer),
                              );
                              if (editingCmdSlot !== opp.id)
                                updateCommanderDamage(targetSlot.id, opp.id, 1);
                            }}
                            onPointerLeave={(e) => {
                              clearTimeout(
                                parseInt(e.currentTarget.dataset.timer),
                              );
                            }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

      {/* 7. COIN FLIP MODAL */}
      {showCoinFlip && (
        <div
          className="absolute inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onPointerDown={() => setShowCoinFlip(false)}
        >
          <div
            className="bg-neutral-900 border border-neutral-800 w-full max-w-xs rounded-2xl p-5 flex flex-col gap-4 shadow-2xl"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <h2 className="text-lg font-bold text-neutral-200">
                🪙 Coin Flip
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
                Number of Flips
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
                setTimeout(() => {
                  const results = Array.from({ length: coinFlipCount }, () =>
                    Math.random() < 0.5 ? "heads" : "tails",
                  );
                  setCoinFlipResults(results);
                  setIsFlipping(false);
                }, 600);
              }}
              disabled={isFlipping}
              className="w-full py-3 bg-yellow-600 hover:bg-yellow-500 disabled:bg-neutral-800 text-white font-black rounded-xl flex items-center justify-center gap-2 text-sm shadow-md active:scale-95 transition-all"
            >
              {isFlipping
                ? "Flipping..."
                : `Flip ${coinFlipCount === 1 ? "1 Coin" : `${coinFlipCount} Coins`}`}
            </button>

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
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
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
          </div>
        </div>
      )}

      {/* 8. WIN SCREEN */}
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
                Winner
              </span>
              <span className="text-5xl font-black text-white drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)]">
                {winner.player.name}
              </span>
              {winner.commanderName && (
                <span className="text-sm font-bold text-neutral-400 uppercase tracking-widest mt-1">
                  {winner.commanderName}
                </span>
              )}
            </div>
            <span className="text-sm text-yellow-400 font-bold bg-yellow-500/10 border border-yellow-500/20 px-4 py-1.5 rounded-full">
              🏆 {(winner.player.wins || 0) + 1} lifetime wins
            </span>
            <button
              onClick={() => {
                setShowControlHub(true);
                setWinner(null);
              }}
              className="mt-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl text-sm shadow-xl active:scale-95 transition-all"
            >
              Reset & Roll Next Game
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
