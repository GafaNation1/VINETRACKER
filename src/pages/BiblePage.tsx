import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, ChevronRight, Loader2, WifiOff } from "lucide-react";
import { useState } from "react";
import { cacheBibleChapter, getCachedBibleChapter } from "@/lib/offlineStore";

interface BibleBook {
  name: string;
  abbr: string;
  chapters: number;
  testament: "Old" | "New";
}

const bibleBooks: BibleBook[] = [
  { name: "Genesis", abbr: "genesis", chapters: 50, testament: "Old" },
  { name: "Exodus", abbr: "exodus", chapters: 40, testament: "Old" },
  { name: "Leviticus", abbr: "leviticus", chapters: 27, testament: "Old" },
  { name: "Numbers", abbr: "numbers", chapters: 36, testament: "Old" },
  { name: "Deuteronomy", abbr: "deuteronomy", chapters: 34, testament: "Old" },
  { name: "Joshua", abbr: "joshua", chapters: 24, testament: "Old" },
  { name: "Judges", abbr: "judges", chapters: 21, testament: "Old" },
  { name: "Ruth", abbr: "ruth", chapters: 4, testament: "Old" },
  { name: "1 Samuel", abbr: "1+samuel", chapters: 31, testament: "Old" },
  { name: "2 Samuel", abbr: "2+samuel", chapters: 24, testament: "Old" },
  { name: "1 Kings", abbr: "1+kings", chapters: 22, testament: "Old" },
  { name: "2 Kings", abbr: "2+kings", chapters: 25, testament: "Old" },
  { name: "1 Chronicles", abbr: "1+chronicles", chapters: 29, testament: "Old" },
  { name: "2 Chronicles", abbr: "2+chronicles", chapters: 36, testament: "Old" },
  { name: "Ezra", abbr: "ezra", chapters: 10, testament: "Old" },
  { name: "Nehemiah", abbr: "nehemiah", chapters: 13, testament: "Old" },
  { name: "Esther", abbr: "esther", chapters: 10, testament: "Old" },
  { name: "Job", abbr: "job", chapters: 42, testament: "Old" },
  { name: "Psalms", abbr: "psalms", chapters: 150, testament: "Old" },
  { name: "Proverbs", abbr: "proverbs", chapters: 31, testament: "Old" },
  { name: "Ecclesiastes", abbr: "ecclesiastes", chapters: 12, testament: "Old" },
  { name: "Song of Solomon", abbr: "song+of+solomon", chapters: 8, testament: "Old" },
  { name: "Isaiah", abbr: "isaiah", chapters: 66, testament: "Old" },
  { name: "Jeremiah", abbr: "jeremiah", chapters: 52, testament: "Old" },
  { name: "Lamentations", abbr: "lamentations", chapters: 5, testament: "Old" },
  { name: "Ezekiel", abbr: "ezekiel", chapters: 48, testament: "Old" },
  { name: "Daniel", abbr: "daniel", chapters: 12, testament: "Old" },
  { name: "Hosea", abbr: "hosea", chapters: 14, testament: "Old" },
  { name: "Joel", abbr: "joel", chapters: 3, testament: "Old" },
  { name: "Amos", abbr: "amos", chapters: 9, testament: "Old" },
  { name: "Obadiah", abbr: "obadiah", chapters: 1, testament: "Old" },
  { name: "Jonah", abbr: "jonah", chapters: 4, testament: "Old" },
  { name: "Micah", abbr: "micah", chapters: 7, testament: "Old" },
  { name: "Nahum", abbr: "nahum", chapters: 3, testament: "Old" },
  { name: "Habakkuk", abbr: "habakkuk", chapters: 3, testament: "Old" },
  { name: "Zephaniah", abbr: "zephaniah", chapters: 3, testament: "Old" },
  { name: "Haggai", abbr: "haggai", chapters: 2, testament: "Old" },
  { name: "Zechariah", abbr: "zechariah", chapters: 14, testament: "Old" },
  { name: "Malachi", abbr: "malachi", chapters: 4, testament: "Old" },
  { name: "Matthew", abbr: "matthew", chapters: 28, testament: "New" },
  { name: "Mark", abbr: "mark", chapters: 16, testament: "New" },
  { name: "Luke", abbr: "luke", chapters: 24, testament: "New" },
  { name: "John", abbr: "john", chapters: 21, testament: "New" },
  { name: "Acts", abbr: "acts", chapters: 28, testament: "New" },
  { name: "Romans", abbr: "romans", chapters: 16, testament: "New" },
  { name: "1 Corinthians", abbr: "1+corinthians", chapters: 16, testament: "New" },
  { name: "2 Corinthians", abbr: "2+corinthians", chapters: 13, testament: "New" },
  { name: "Galatians", abbr: "galatians", chapters: 6, testament: "New" },
  { name: "Ephesians", abbr: "ephesians", chapters: 6, testament: "New" },
  { name: "Philippians", abbr: "philippians", chapters: 4, testament: "New" },
  { name: "Colossians", abbr: "colossians", chapters: 4, testament: "New" },
  { name: "1 Thessalonians", abbr: "1+thessalonians", chapters: 5, testament: "New" },
  { name: "2 Thessalonians", abbr: "2+thessalonians", chapters: 3, testament: "New" },
  { name: "1 Timothy", abbr: "1+timothy", chapters: 6, testament: "New" },
  { name: "2 Timothy", abbr: "2+timothy", chapters: 4, testament: "New" },
  { name: "Titus", abbr: "titus", chapters: 3, testament: "New" },
  { name: "Philemon", abbr: "philemon", chapters: 1, testament: "New" },
  { name: "Hebrews", abbr: "hebrews", chapters: 13, testament: "New" },
  { name: "James", abbr: "james", chapters: 5, testament: "New" },
  { name: "1 Peter", abbr: "1+peter", chapters: 5, testament: "New" },
  { name: "2 Peter", abbr: "2+peter", chapters: 3, testament: "New" },
  { name: "1 John", abbr: "1+john", chapters: 5, testament: "New" },
  { name: "2 John", abbr: "2+john", chapters: 1, testament: "New" },
  { name: "3 John", abbr: "3+john", chapters: 1, testament: "New" },
  { name: "Jude", abbr: "jude", chapters: 1, testament: "New" },
  { name: "Revelation", abbr: "revelation", chapters: 22, testament: "New" },
];

interface Verse {
  verse: number;
  text: string;
}

const BiblePage = () => {
  const navigate = useNavigate();
  const [view, setView] = useState<"books" | "chapters" | "reading">("books");
  const [testamentFilter, setTestamentFilter] = useState<"all" | "Old" | "New">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBook, setSelectedBook] = useState<BibleBook | null>(null);
  const [selectedChapter, setSelectedChapter] = useState(1);
  const [verses, setVerses] = useState<Verse[]>([]);
  const [loadingVerses, setLoadingVerses] = useState(false);
  const [error, setError] = useState("");
  const [isOffline, setIsOffline] = useState(false);

  const filteredBooks = bibleBooks.filter(b => {
    const matchesTestament = testamentFilter === "all" || b.testament === testamentFilter;
    const matchesSearch = !searchQuery || b.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTestament && matchesSearch;
  });

  const fetchChapter = async (book: BibleBook, chapter: number) => {
    setLoadingVerses(true);
    setError("");
    setVerses([]);
    setIsOffline(false);

    const cacheKey = `${book.abbr}_${chapter}`;

    // Try cache first
    const cached = await getCachedBibleChapter(cacheKey);

    if (!navigator.onLine) {
      if (cached) {
        setVerses(cached);
        setIsOffline(true);
      } else {
        setError("This chapter hasn't been cached yet. Connect to the internet to load it first.");
      }
      setLoadingVerses(false);
      return;
    }

    // Online: try API, fall back to cache
    try {
      const res = await fetch(`https://bible-api.com/${book.abbr}+${chapter}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      let parsed: Verse[] = [];
      if (data.verses) {
        parsed = data.verses.map((v: any) => ({ verse: v.verse, text: v.text }));
      } else if (data.text) {
        parsed = [{ verse: 1, text: data.text }];
      }
      setVerses(parsed);
      // Cache for offline use
      if (parsed.length > 0) {
        await cacheBibleChapter(cacheKey, parsed);
      }
    } catch {
      if (cached) {
        setVerses(cached);
        setIsOffline(true);
      } else {
        setError("Could not load this chapter. Please try again.");
      }
    }
    setLoadingVerses(false);
  };

  const selectBook = (book: BibleBook) => {
    setSelectedBook(book);
    if (book.chapters === 1) {
      setSelectedChapter(1);
      setView("reading");
      fetchChapter(book, 1);
    } else {
      setView("chapters");
    }
  };

  const selectChapter = (chapter: number) => {
    if (!selectedBook) return;
    setSelectedChapter(chapter);
    setView("reading");
    fetchChapter(selectedBook, chapter);
  };

  const goBack = () => {
    if (view === "reading") {
      if (selectedBook && selectedBook.chapters === 1) { setView("books"); setSelectedBook(null); }
      else setView("chapters");
    } else if (view === "chapters") { setView("books"); setSelectedBook(null); }
    else navigate(-1);
  };

  const goNextChapter = () => {
    if (!selectedBook || selectedChapter >= selectedBook.chapters) return;
    selectChapter(selectedChapter + 1);
  };

  const goPrevChapter = () => {
    if (!selectedBook || selectedChapter <= 1) return;
    selectChapter(selectedChapter - 1);
  };

  return (
    <div className="min-h-screen">
      <div className="px-5 pt-14 pb-6">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={goBack} className="rounded-full border border-border bg-card p-2 transition-colors hover:bg-secondary">
            <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={1.7} />
          </button>
          <h1 className="text-xl font-bold tracking-tight">
            {view === "books" ? "Bible" : view === "chapters" ? selectedBook?.name : `${selectedBook?.name} ${selectedChapter}`}
          </h1>
        </div>

        {view === "books" && (
          <>
            <div className="relative mb-4">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input type="text" placeholder="Search books..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full rounded-xl border border-input bg-card py-3 pl-10 pr-4 text-sm outline-none transition-colors focus:border-primary/30 focus:ring-2 focus:ring-primary/10" />
            </div>

            <div className="flex gap-1.5 mb-4">
              {(["all", "Old", "New"] as const).map(f => (
                <button key={f} onClick={() => setTestamentFilter(f)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${testamentFilter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"}`}>
                  {f === "all" ? "All" : `${f} Testament`}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2">
              {filteredBooks.map(book => (
                <button key={book.name} onClick={() => selectBook(book)}
                  className="rounded-xl border border-border bg-card p-3 text-xs font-medium text-center transition-colors hover:bg-accent hover:border-primary/20">
                  <span className="block truncate">{book.name}</span>
                  <span className="text-[10px] text-muted-foreground">{book.chapters} ch</span>
                </button>
              ))}
            </div>
          </>
        )}

        {view === "chapters" && selectedBook && (
          <div className="grid grid-cols-5 gap-2">
            {Array.from({ length: selectedBook.chapters }, (_, i) => i + 1).map(ch => (
              <button key={ch} onClick={() => selectChapter(ch)}
                className="rounded-xl border border-border bg-card p-3 text-sm font-medium text-center transition-colors hover:bg-accent hover:border-primary/20">
                {ch}
              </button>
            ))}
          </div>
        )}

        {view === "reading" && (
          <div>
            {isOffline && (
              <div className="mb-3 flex items-center gap-2 rounded-xl bg-accent px-3 py-2 text-xs text-accent-foreground">
                <WifiOff className="h-3.5 w-3.5" />
                <span>Reading from offline cache</span>
              </div>
            )}
            {loadingVerses && (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-sm text-muted-foreground">Loading...</span>
              </div>
            )}
            {error && (
              <div className="text-center py-16">
                <p className="text-sm text-destructive">{error}</p>
                <button onClick={() => selectedBook && fetchChapter(selectedBook, selectedChapter)} className="mt-2 text-sm font-medium text-primary">
                  Try Again
                </button>
              </div>
            )}
            {!loadingVerses && !error && (
              <>
                <div className="space-y-0.5">
                  {verses.map(verse => (
                    <div key={verse.verse} className="py-2.5">
                      <span className="text-xs font-bold text-primary mr-1.5">{verse.verse}</span>
                      <span className="text-sm leading-relaxed">{verse.text.trim()}</span>
                    </div>
                  ))}
                </div>

                {selectedBook && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t border-border">
                    <button onClick={goPrevChapter} disabled={selectedChapter <= 1}
                      className="flex items-center gap-1 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-30">
                      <ArrowLeft className="h-3.5 w-3.5" /> Previous
                    </button>
                    <span className="text-xs text-muted-foreground">{selectedChapter} / {selectedBook.chapters}</span>
                    <button onClick={goNextChapter} disabled={selectedChapter >= selectedBook.chapters}
                      className="flex items-center gap-1 rounded-xl border border-border bg-card px-4 py-2.5 text-xs font-medium transition-colors hover:bg-accent disabled:opacity-30">
                      Next <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}

                <p className="text-[10px] text-muted-foreground text-center mt-4">World English Bible (Public Domain)</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BiblePage;
