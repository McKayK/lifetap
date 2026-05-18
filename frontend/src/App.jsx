import React, { useState, useEffect } from "react";
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
      poison: 0,
      commanderDamage: { 1: 0, 2: 0, 3: 0, 4: 0 },
    },
    {
      id: 2,
      label: "Slot 1",
      player: null,
      life: 40,
      bgImage: "",
      commanderName: "",
      poison: 0,
      commanderDamage: { 1: 0, 2: 0, 3: 0, 4: 0 },
    },
    {
      id: 3,
      label: "Slot 1",
      player: null,
      life: 40,
      bgImage: "",
      commanderName: "",
      poison: 0,
      commanderDamage: { 1: 0, 2: 0, 3: 0, 4: 0 },
    },
    {
      id: 4,
      label: "Slot 1",
      player: null,
      life: 40,
      bgImage: "",
      commanderName: "",
      poison: 0,
      commanderDamage: { 1: 0, 2: 0, 3: 0, 4: 0 },
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

  // Scryfall & Favorites States
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [playerFavorites, setPlayerFavorites] = useState([]);

  // Match Control States
  const [showControlHub, setShowControlHub] = useState(false);
  const [startingPlayerId, setStartingPlayerId] = useState(null);
  const [isRolling, setIsRolling] = useState(false);

  //   const BACKEND_URL = "http://localhost:5000/api";
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
      await fetch(`${BACKEND_URL}/games/${gameId}`, { method: "DELETE" });
      setGameHistory((prev) => prev.filter((g) => g.id !== gameId));
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
        // If this player is assigned to a slot, unlink them
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
        // Update the name live on any slot using this player
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

  const updateLife = (id, amount) => {
    setLifeHistory((prev) => ({
      ...prev,
      [id]: [...(prev[id] || []), slots.find((s) => s.id === id).life],
    }));
    setSlots(
      slots.map((s) => (s.id === id ? { ...s, life: s.life + amount } : s)),
    );
  };

  const updatePoison = (id, amount) => {
    setSlots(
      slots.map((s) =>
        s.id === id ? { ...s, poison: Math.max(0, s.poison + amount) } : s,
      ),
    );
  };

  const handleUndoLife = (id) => {
    const history = lifeHistory[id];
    if (!history || history.length === 0) return;
    const previous = history[history.length - 1];
    setLifeHistory((prev) => ({
      ...prev,
      [id]: prev[id].slice(0, -1),
    }));
    setSlots(slots.map((s) => (s.id === id ? { ...s, life: previous } : s)));
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
  };

  const handleNewGameAndRoll = () => {
    setShowControlHub(false);
    setSlots(
      slots.map((s) => ({
        ...s,
        life: 40,
        poison: 0,
        commanderDamage: { 1: 0, 2: 0, 3: 0, 4: 0 },
        killedBySlotId: null,
      })),
    );
    setStartingPlayerId(null);
    setIsRolling(true);

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
    setLifeHistory({});
    setTurnCount(1);
  };

  const handleRecordWin = async (playerId) => {
    try {
      const res = await fetch(`${BACKEND_URL}/players/${playerId}/win`, {
        method: "POST",
      });
      if (res.ok) {
        const winner = slots.find((s) => s.player?.id === playerId)?.player;
        await handleLogGame(playerId, winner?.name || "Unknown");
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

  const getActiveSlotPlayer = () =>
    slots.find((s) => s.id === activeMenuSlot)?.player;

  const getGridClasses = () => {
    if (playerCount === 2) return "grid-cols-1 grid-rows-2";
    return "grid-cols-2 grid-rows-2";
  };

  const getShortName = (slot) => {
    if (slot.player) {
      // If the name is 5 letters or less, show the whole thing. Otherwise, truncate cleanly.
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

  const getNemesis = (slot) => {
    const entries = Object.entries(slot.commanderDamage).filter(
      ([id, dmg]) => parseInt(id) !== slot.id && dmg > 0,
    );
    if (entries.length === 0) return null;
    const [nemesisId, dmg] = entries.reduce((a, b) => (b[1] > a[1] ? b : a));
    const nemesisSlot = slots.find((s) => s.id === parseInt(nemesisId));
    if (!nemesisSlot) return null;
    return { name: getShortName(nemesisSlot), dmg };
  };

  const getCommanderName = (slot) => slot.commanderName || "";

  return (
    <div
      className={`h-screen w-screen grid bg-neutral-950 p-1 gap-1 select-none text-white relative overflow-hidden ${getGridClasses()}`}
    >
      {/* 1. PLAYERS GRID LAYOUT */}
      {visibleSlots.map((slot, index) => {
        const isRotated = playerCount === 2 ? index === 0 : index < 2;
        const displayName = slot.player ? slot.player.name : slot.label;
        const isStartingPlayer = startingPlayerId === slot.id;
        const is3PlayerSpannedRow = playerCount === 3 && index === 2;

        const isLethalPoison = slot.poison >= 10;
        const lethalCommanderDamage = Object.values(slot.commanderDamage).some(
          (dmg) => dmg >= 21,
        );
        const isDefeated =
          slot.life <= 0 || lethalCommanderDamage || isLethalPoison;

        return (
          <div
            key={slot.id}
            className={`relative flex flex-col items-center justify-center rounded-2xl overflow-hidden border transition-all duration-500 bg-neutral-900 ${
              isStartingPlayer
                ? "border-yellow-500 shadow-[inset_0_0_20px_rgba(234,179,8,0.15)]"
                : "border-neutral-800"
            } ${isRotated ? "rotate-180" : ""} ${is3PlayerSpannedRow ? "col-span-2" : ""}`}
          >
            {slot.bgImage && (
              <div
                className={`absolute inset-0 bg-cover transition-all duration-700 ${
                  playerCount === 2 ? "bg-center" : "bg-top"
                }`}
                style={{
                  backgroundImage: `url(${slot.bgImage})`,
                  filter: "brightness(0.35) contrast(1.15)",
                }}
              />
            )}

            {/* Tap Targets */}
            <div className="absolute inset-0 flex">
              <div
                onClick={() => updateLife(slot.id, -1)}
                className="w-1/2 h-full active:bg-red-500/10 transition-colors cursor-pointer"
              />
              <div
                onClick={() => updateLife(slot.id, 1)}
                className="w-1/2 h-full active:bg-green-500/10 transition-colors cursor-pointer"
              />
            </div>

            {/* UI Content Layer */}
            <div className="relative z-10 pointer-events-none flex flex-col items-center justify-between h-full w-full p-4">
              <div className="flex justify-between w-full items-center pointer-events-auto relative">
                {/* LEFT: Player Name */}
                <span
                  className={`font-bold text-sm md:text-base tracking-wide flex items-center gap-1 bg-black/50 px-3 py-1 rounded-full backdrop-blur-md border ${
                    isStartingPlayer
                      ? "border-yellow-500/50 text-yellow-400"
                      : "border-neutral-700/30 text-neutral-200"
                  }`}
                >
                  <User size={14} /> {displayName}
                  {slot.player && getWinStreak(slot.player.id) >= 2 && (
                    <span className="text-sm filter drop-shadow-[0_0_6px_rgba(251,146,60,0.8)]">
                      🔥
                    </span>
                  )}
                </span>

                {/* MIDDLE: Commander Name Badge */}
                {slot.bgImage && (
                  <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 bg-black/60 border border-neutral-800 backdrop-blur-md px-3 py-1 rounded-md max-w-[120px] sm:max-w-[180px] truncate shadow-md">
                    <span className="text-[10px] md:text-xs font-black tracking-wide text-neutral-300 uppercase block truncate">
                      {getCommanderName(slot)}
                    </span>
                  </div>
                )}

                {/* RIGHT: Settings Button */}
                <button
                  onClick={() => setActiveMenuSlot(slot.id)}
                  className={`p-2 bg-black/50 hover:bg-black/70 border rounded-full backdrop-blur-md transition-all ${
                    isStartingPlayer
                      ? "border-yellow-500/30 text-yellow-500/70 hover:text-yellow-400"
                      : "border-neutral-700/30 text-neutral-400 hover:text-white"
                  }`}
                >
                  <Settings size={16} />
                </button>
              </div>

              {/* MASSIVE LIFE TOTAL WINDOW (Leaves this perfectly intact below) */}

              {/* MASSIVE LIFE TOTAL WINDOW */}
              <div className="flex flex-col items-center justify-center my-auto">
                <span className="text-7xl sm:text-8xl md:text-9xl font-black tracking-tighter drop-shadow-[0_4px_24px_rgba(0,0,0,0.95)] text-white tabular-nums">
                  {slot.life}
                </span>
              </div>

              {/* LOWER INTERACTIVE FOOTER */}
              <div className="w-full flex flex-col items-center gap-2 pointer-events-auto z-30 px-2">
                <div className="flex items-center gap-2 bg-black/40 border border-neutral-800/60 px-2 py-1 rounded-xl backdrop-blur-sm">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updatePoison(slot.id, -1);
                    }}
                    className="w-6 h-6 flex items-center justify-center bg-neutral-800 hover:bg-neutral-700 text-neutral-400 font-black text-xs rounded-lg active:scale-90 transition-transform"
                  >
                    −
                  </button>
                  <div className="flex items-center gap-1 min-w-[48px] justify-center">
                    <span
                      className={`text-sm ${slot.poison >= 10 ? "text-green-400 drop-shadow-[0_0_6px_rgba(74,222,128,0.6)]" : slot.poison >= 7 ? "text-yellow-400" : "text-neutral-500"}`}
                    >
                      🧪
                    </span>
                    <span
                      className={`text-sm font-black tabular-nums ${slot.poison >= 10 ? "text-green-400" : slot.poison >= 7 ? "text-yellow-400" : "text-neutral-400"}`}
                    >
                      {slot.poison}/10
                    </span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      updatePoison(slot.id, 1);
                    }}
                    className="w-6 h-6 flex items-center justify-center bg-neutral-800 hover:bg-neutral-700 text-neutral-400 font-black text-xs rounded-lg active:scale-90 transition-transform"
                  >
                    +
                  </button>
                </div>
                {(() => {
                  const nemesis = getNemesis(slot);
                  return nemesis ? (
                    <div className="flex items-center gap-1 bg-black/40 border border-red-900/40 px-2 py-0.5 rounded-full backdrop-blur-sm">
                      <span className="text-[10px] font-black uppercase tracking-wider text-red-400">
                        ⚔️ {nemesis.name}
                      </span>
                      <span className="text-[10px] font-black text-red-300 tabular-nums">
                        {nemesis.dmg}
                      </span>
                    </div>
                  ) : null;
                })()}
                {activeCmdModifier &&
                activeCmdModifier.targetSlotId === slot.id ? (
                  /* INDIVIDUAL COMMANDER DAMAGE CONTROL PANEL */
                  <div className="w-full max-w-xs bg-black/80 p-2 rounded-xl border border-neutral-700 backdrop-blur-md flex flex-col gap-2">
                    <div className="flex items-center justify-between border-b border-neutral-800 pb-1 px-1">
                      <span className="text-[11px] font-black uppercase tracking-wider text-red-400">
                        From{" "}
                        {getShortName(
                          slots.find(
                            (s) => s.id === activeCmdModifier.opponentSlotId,
                          ),
                        )}
                        :
                      </span>
                      <span className="text-sm text-white bg-neutral-800 px-2 py-0.5 rounded-md font-black tabular-nums">
                        {slot.commanderDamage[
                          activeCmdModifier.opponentSlotId
                        ] || 0}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1">
                      <button
                        onClick={() =>
                          updateCommanderDamage(
                            slot.id,
                            activeCmdModifier.opponentSlotId,
                            -1,
                          )
                        }
                        className="h-9 flex items-center justify-center bg-neutral-800 hover:bg-neutral-700 font-black text-sm rounded-lg border border-neutral-700 active:scale-90 transition-transform"
                      >
                        -1
                      </button>
                      <button
                        onClick={() =>
                          updateCommanderDamage(
                            slot.id,
                            activeCmdModifier.opponentSlotId,
                            1,
                          )
                        }
                        className="h-9 flex items-center justify-center bg-red-600/30 hover:bg-red-600/50 text-red-200 font-black text-sm rounded-lg border border-red-500/30 active:scale-90 transition-transform"
                      >
                        +1
                      </button>
                      <button
                        onClick={() => setActiveCmdModifier(null)}
                        className="h-9 flex items-center justify-center bg-neutral-900 text-neutral-400 hover:text-white rounded-lg border border-neutral-800 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ) : (
                  /* LIFETAP STYLE 2x2 COMMANDER DAMAGE MATRIX */
                  <div className="w-full max-w-[240px] grid grid-cols-2 gap-1 bg-black/40 p-1 rounded-xl border border-neutral-800/60 backdrop-blur-sm">
                    {/* Map all 4 slots into the grid to maintain a solid 2x2 shape */}
                    {slots.map((opp) => {
                      // If the slot matches the current player, show a disabled spacer or placeholder
                      if (opp.id === slot.id) {
                        return (
                          <div
                            key={`self-${opp.id}`}
                            className="h-8 rounded-lg bg-neutral-950/20 border border-transparent"
                          />
                        );
                      }

                      // Check if this opponent is actually in the current match size
                      const isOpponentInGame = opp.id <= playerCount;
                      const amt = slot.commanderDamage[opp.id] || 0;

                      return (
                        <button
                          key={opp.id}
                          disabled={!isOpponentInGame}
                          onClick={() =>
                            setActiveCmdModifier({
                              targetSlotId: slot.id,
                              opponentSlotId: opp.id,
                            })
                          }
                          className={`h-10 px-2 text-xs font-black rounded-lg transition-all flex items-center justify-between border tabular-nums ${
                            !isOpponentInGame
                              ? "bg-neutral-950/40 text-neutral-700 border-neutral-900/30 opacity-20 cursor-not-allowed"
                              : amt > 0
                                ? "bg-red-950/60 text-red-200 border-red-700/50 shadow-[inset_0_0_10px_rgba(220,38,38,0.15)]"
                                : "bg-neutral-900/70 text-neutral-400 border-neutral-800 hover:text-neutral-200"
                          }`}
                        >
                          <span className="tracking-wide truncate max-w-[40px] uppercase text-[10px] opacity-80">
                            {getShortName(opp)}
                          </span>

                          {isOpponentInGame && (
                            <span
                              className={`text-base font-black tracking-tight ${
                                amt > 0
                                  ? "text-red-400 drop-shadow-[0_0_6px_rgba(239,68,68,0.2)]"
                                  : "text-neutral-500"
                              }`}
                            >
                              {amt}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* BASE MODIFIER BUTTONS */}
                <div className="flex gap-6 mb-1">
                  <button
                    onClick={() => updateLife(slot.id, -5)}
                    className="px-5 py-1.5 bg-black/50 hover:bg-black/70 border border-neutral-700/30 active:scale-95 text-red-400 font-black text-sm rounded-xl backdrop-blur-md transition-all tracking-wider"
                  >
                    -5
                  </button>
                  <button
                    onClick={() => updateLife(slot.id, 5)}
                    className="px-5 py-1.5 bg-black/50 hover:bg-black/70 border border-neutral-700/30 active:scale-95 text-green-400 font-black text-sm rounded-xl backdrop-blur-md transition-all tracking-wider"
                  >
                    +5
                  </button>
                  {(lifeHistory[slot.id]?.length || 0) > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUndoLife(slot.id);
                      }}
                      className="flex items-center gap-1 px-3 py-1 bg-black/40 hover:bg-black/60 border border-neutral-700/40 text-neutral-500 hover:text-neutral-300 text-[11px] font-bold rounded-xl backdrop-blur-md transition-all active:scale-95 tracking-wide uppercase"
                    >
                      ↩ Undo
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* DEFEATED OVERLAY */}
            {isDefeated && (
              <div className="absolute inset-0 z-20 bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center gap-1 pointer-events-none select-none">
                <span className="text-5xl filter drop-shadow-[0_0_15px_rgba(0,0,0,1)] opacity-90">
                  {isLethalPoison ? "🧪" : "💀"}
                </span>
                <span className="text-xs font-black uppercase tracking-widest text-red-600 drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">
                  {isLethalPoison
                    ? "Poison Lethal"
                    : lethalCommanderDamage
                      ? "Commander Lethal"
                      : "Defeated"}
                </span>
                {lethalCommanderDamage &&
                  !isLethalPoison &&
                  slot.killedBySlotId && (
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
          onClick={() => setShowControlHub(true)}
          className="p-3 bg-neutral-900 border-2 border-neutral-700 hover:border-neutral-500 text-neutral-400 hover:text-white rounded-full shadow-[0_0_20px_rgba(0,0,0,0.75)] active:scale-90 transition-all backdrop-blur-lg"
        >
          <Layers size={20} />
        </button>
      </div>

      {/* 3. GLOBAL MATCH CONTROL MODAL */}
      {showControlHub && (
        <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 w-full max-w-xs rounded-2xl p-5 flex flex-col gap-4 shadow-2xl relative">
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
              <div className="grid grid-cols-3 gap-1.5 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
                {[2, 3, 4].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => {
                      setPlayerCount(num);
                      setStartingPlayerId(null);
                    }}
                    className={`py-1.5 rounded-lg font-bold text-xs transition-all ${
                      playerCount === num
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900"
                    }`}
                  >
                    {num} P
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[11px] uppercase tracking-wider font-semibold text-neutral-400 block mb-1.5 flex items-center gap-1">
                <Dices size={12} /> Turn Counter
              </label>
              <div className="flex items-center gap-2 bg-neutral-950 p-2 rounded-xl border border-neutral-800">
                <button
                  onClick={() => setTurnCount((t) => Math.max(1, t - 1))}
                  className="w-9 h-9 flex items-center justify-center bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-black rounded-lg border border-neutral-700 active:scale-90 transition-transform"
                >
                  −
                </button>
                <span className="flex-1 text-center text-lg font-black text-white tabular-nums">
                  {turnCount}
                </span>
                <button
                  onClick={() => setTurnCount((t) => t + 1)}
                  className="w-9 h-9 flex items-center justify-center bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-black rounded-lg border border-neutral-700 active:scale-90 transition-transform"
                >
                  +
                </button>
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

      {/* 4. SLOT PROFILE MANIFEST DRAWERS */}
      {activeMenuSlot !== null && (
        <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 w-full max-w-md rounded-2xl p-6 flex flex-col gap-5 max-h-[90vh] overflow-y-auto shadow-2xl">
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
                                className="flex-1 bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-0.5 text-sm text-white outline-none focus:border-neutral-500"
                              />
                              <button
                                onClick={() => handleRenamePlayer(p.id)}
                                className="text-xs bg-blue-600 hover:bg-blue-500 text-white font-bold px-2 py-0.5 rounded-lg transition-all"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  setRenamingPlayerId(null);
                                  setRenameValue("");
                                }}
                                className="text-xs text-neutral-400 hover:text-white px-1 transition-colors"
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
                                className="flex-1 flex justify-between items-center text-sm text-neutral-200 hover:text-white transition-all group"
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
                                className="p-1.5 text-neutral-500 hover:text-blue-400 transition-colors rounded-lg hover:bg-neutral-700"
                              >
                                <Settings size={13} />
                              </button>
                              <button
                                onClick={() => handleDeletePlayer(p.id)}
                                className="p-1.5 text-neutral-500 hover:text-red-400 transition-colors rounded-lg hover:bg-neutral-700"
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
                          className="flex-1 bg-neutral-950 border border-neutral-700 rounded-lg px-2 py-0.5 text-sm text-white outline-none focus:border-neutral-500"
                        />
                        <button
                          onClick={() =>
                            handleRenamePlayer(getActiveSlotPlayer().id)
                          }
                          className="text-xs bg-blue-600 hover:bg-blue-500 text-white font-bold px-2 py-1 rounded-lg transition-all"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            setRenamingPlayerId(null);
                            setRenameValue("");
                          }}
                          className="text-xs text-neutral-400 hover:text-white px-1 transition-colors"
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
                          className="p-1 text-neutral-500 hover:text-blue-400 transition-colors rounded-lg hover:bg-neutral-800"
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
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
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

                      const currentSlot = slots.find((s) =>
                        s.id === activeMenuSlot
                          ? {
                              ...s,
                              bgImage: savedFavorite.image_url,
                              commanderName: name,
                            }
                          : s,
                      );
                      const formData = new FormData();
                      formData.append("commander_name", name);
                      formData.append("image", file);

                      try {
                        const res = await fetch(
                          `${BACKEND_URL}/players/${currentSlot.player.id}/upload-favorite`,
                          {
                            method: "POST",
                            body: formData,
                          },
                        );
                        if (res.ok) {
                          const savedFavorite = await res.json();
                          e.target.reset();
                          fetchFavorites(currentSlot.player.id);
                          setSlots(
                            slots.map((s) =>
                              s.id === activeMenuSlot
                                ? { ...s, bgImage: savedFavorite.image_url }
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
                        className="flex-1 text-xs text-neutral-400 file:mr-2 file:py-1 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-neutral-800 file:text-neutral-200 file:hover:bg-neutral-700 cursor-pointer"
                        required
                      />
                      <button
                        type="submit"
                        className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs rounded-xl transition-all shadow-md"
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
                          className="w-full flex items-center gap-3 p-1.5 hover:bg-neutral-800/60 rounded-lg text-left transition-all group"
                        >
                          {img && (
                            <img
                              src={img}
                              className="h-9 w-12 object-cover rounded-md border border-neutral-800"
                              alt=""
                            />
                          )}
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-neutral-200 group-hover:text-white transition-colors">
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
      {showHistory && (
        <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-neutral-900 border border-neutral-800 w-full max-w-sm rounded-2xl p-5 flex flex-col gap-4 max-h-[85vh] shadow-2xl">
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
                          {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          },
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
    </div>
  );
}
