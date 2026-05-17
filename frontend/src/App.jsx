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
    { id: 1, label: "Slot 1", player: null, life: 40, bgImage: "" },
    { id: 2, label: "Slot 2", player: null, life: 40, bgImage: "" },
    { id: 3, label: "Slot 3", player: null, life: 40, bgImage: "" },
    { id: 4, label: "Slot 4", player: null, life: 40, bgImage: "" },
  ]);

  const [playerCount, setPlayerCount] = useState(4);
  const [dbPlayers, setDbPlayers] = useState([]);
  const [activeMenuSlot, setActiveMenuSlot] = useState(null);
  const [newPlayerName, setNewPlayerName] = useState("");

  // Scryfall & Favorites States
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [playerFavorites, setPlayerFavorites] = useState([]);

  // Match Control States
  const [showControlHub, setShowControlHub] = useState(false);
  const [startingPlayerId, setStartingPlayerId] = useState(null);
  const [isRolling, setIsRolling] = useState(false);

  const BACKEND_URL = "http://localhost:5000/api";
  // const BACKEND_URL = "https://life.mckaykleinman.com/api";

  const visibleSlots = slots.slice(0, playerCount);

  useEffect(() => {
    fetchPlayers();
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
          s.id === activeMenuSlot ? { ...s, bgImage: image_url } : s,
        ),
      );
      setActiveMenuSlot(null);
    } catch (err) {
      console.error("Error saving favorite:", err);
    }
  };

  const handleSelectExistingFavorite = (imageUrl) => {
    setSlots(
      slots.map((s) =>
        s.id === activeMenuSlot ? { ...s, bgImage: imageUrl } : s,
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
    setSlots(
      slots.map((s) => (s.id === id ? { ...s, life: s.life + amount } : s)),
    );
  };

  const handleNewGameAndRoll = () => {
    setShowControlHub(false);
    setSlots(slots.map((s) => ({ ...s, life: 40 })));
    setIsRolling(true);
    setStartingPlayerId(null);

    let counter = 0;
    const maxTicks = 10;

    const interval = setInterval(() => {
      // Pull strictly from the pool of active, visible layout slots
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
        fetchPlayers();
        setSlots(
          slots.map((s) => {
            if (s.player && s.player.id === playerId) {
              return {
                ...s,
                player: {
                  ...s.player,
                  wins: (s.player.wins || 0) + 1,
                },
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

  return (
    <div
      className={`h-screen w-screen grid bg-neutral-950 p-1 gap-1 select-none text-white relative overflow-hidden ${getGridClasses()}`}
    >
      {visibleSlots.map((slot, index) => {
        const isRotated = playerCount === 2 ? index === 0 : index < 2;
        const displayName = slot.player ? slot.player.name : slot.label;
        const isStartingPlayer = startingPlayerId === slot.id;
        const is3PlayerSpannedRow = playerCount === 3 && index === 2;

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

            {/* Tap Targets (Always Active) */}
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
              <div className="flex justify-between w-full items-center pointer-events-auto">
                <span
                  className={`font-bold text-sm md:text-base tracking-wide flex items-center gap-1 bg-black/50 px-3 py-1 rounded-full backdrop-blur-md border ${
                    isStartingPlayer
                      ? "border-yellow-500/50 text-yellow-400"
                      : "border-neutral-700/30 text-neutral-200"
                  }`}
                >
                  <User size={14} /> {displayName}
                </span>
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

              {/* MASSIVE LIFE TOTAL WINDOW */}
              <div className="flex flex-col items-center justify-center my-auto">
                <span className="text-7xl sm:text-8xl md:text-9xl font-black tracking-tighter drop-shadow-[0_4px_24px_rgba(0,0,0,0.95)] text-white select-none tabular-nums">
                  {slot.life}
                </span>
              </div>

              {/* BIG MODIFIER BUTTONS (Always Active) */}
              <div className="flex gap-6 pointer-events-auto mb-2">
                <button
                  onClick={() => updateLife(slot.id, -5)}
                  className="px-5 py-2 bg-black/50 hover:bg-black/70 border border-neutral-700/30 active:scale-95 text-red-400 font-black text-sm rounded-xl backdrop-blur-md transition-all tracking-wider"
                >
                  -5
                </button>
                <button
                  onClick={() => updateLife(slot.id, 5)}
                  className="px-5 py-2 bg-black/50 hover:bg-black/70 border border-neutral-700/30 active:scale-95 text-green-400 font-black text-sm rounded-xl backdrop-blur-md transition-all tracking-wider"
                >
                  +5
                </button>
              </div>
            </div>

            {/* --- DEFEATED OVERLAY (Passes clicks through to buttons underneath) --- */}
            {slot.life <= 0 && (
              <div className="absolute inset-0 z-20 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center gap-1 pointer-events-none select-none animate-fade-in">
                <span className="text-6xl filter drop-shadow-[0_0_15px_rgba(0,0,0,1)] opacity-90">
                  💀
                </span>
                <span className="text-sm font-black uppercase tracking-widest text-red-600 drop-shadow-[0_2px_4px_rgba(0,0,0,1)]">
                  Defeated
                </span>
              </div>
            )}
          </div>
        );
      })}

      {/* --- DEAD CENTER CONTROL HUB BUTTON --- */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40">
        <button
          onClick={() => setShowControlHub(true)}
          className="p-3 bg-neutral-900 border-2 border-neutral-700 hover:border-neutral-500 text-neutral-400 hover:text-white rounded-full shadow-[0_0_20px_rgba(0,0,0,0.75)] active:scale-90 transition-all backdrop-blur-lg"
        >
          <Layers size={20} />
        </button>
      </div>

      {/* --- MATCH CONTROL MODAL --- */}
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

            {/* POD SIZE SELECTION */}
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

      {/* --- SLOT CONFIGURATION DRAWERS --- */}
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
                        <button
                          key={p.id}
                          onClick={() => assignPlayerToSlot(activeMenuSlot, p)}
                          className="w-full flex justify-between items-center px-4 py-2 rounded-lg text-sm bg-neutral-800 hover:bg-neutral-700 text-neutral-200 transition-all group"
                        >
                          <span>{p.name}</span>
                          <span className="text-xs bg-neutral-900 px-2 py-0.5 rounded-md border border-neutral-700/50 text-amber-400 font-medium group-hover:border-amber-500/30 transition-all">
                            🏆 {p.wins || 0}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2 bg-neutral-950 p-3 border border-neutral-800 rounded-xl">
                  <div className="flex justify-between items-center border-b border-neutral-800/60 pb-2">
                    <span className="text-sm font-bold text-blue-400">
                      Profile: {getActiveSlotPlayer().name}
                    </span>
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

                {/* FAVORITES SHELF */}
                <div>
                  <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Star
                      size={12}
                      className="text-yellow-500 fill-yellow-500"
                    />{" "}
                    Favorites List
                  </h3>
                  <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin pointer-events-auto">
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

                {/* ADD CUSTOM PROXY ART FORM */}
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
                    className="flex flex-col gap-2 pointer-events-auto"
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

                {/* SEARCH SCRYFALL FORM */}
                <div className="border-t border-neutral-800/60 pt-3">
                  <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2">
                    Search Scryfall Art
                  </h3>
                  <form
                    onSubmit={handleScryfallSearch}
                    className="flex gap-2 pointer-events-auto"
                  >
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
                  <div className="border border-neutral-800 bg-neutral-950 p-2 rounded-xl max-h-[150px] overflow-y-auto flex flex-col gap-1 pointer-events-auto">
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
    </div>
  );
}
