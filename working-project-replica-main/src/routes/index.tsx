import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { Button } from "@/components/ui/button";
import { SkillSwapAuthDialog } from "@/components/skillswap-auth-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { LovableMark } from "@lovable.dev/cloud-auth-js/react";
import {
  ArrowDownUp,
  ArrowRight,
  Bookmark,
  BookOpen,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Compass,
  Heart,
  ListFilter,
  LogOut,
  Mail,
  MessageSquare,
  Pencil,
  Search,
  Settings2,
  Sparkles,
  Star,
  UserRound,
  UsersRound,
} from "lucide-react";
import heroStudents from "@/assets/students-community.jpg";
import { demoStudents, filterStudents, profileSkills, skillMatchPercent, type SkillStudent } from "@/lib/skillswap";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Discover student skill swaps | SkillSwap" },
      { name: "description", content: "Find students to trade what you know for what you want to learn." },
      { property: "og:title", content: "Discover student skill swaps | SkillSwap" },
      { property: "og:description", content: "Find students to trade what you know for what you want to learn." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

type Profile = Tables<"profiles">;
type Exchange = Tables<"skill_exchanges">;
type Section = "Discover" | "My exchanges" | "Saved" | "Messages" | "My profile" | "Settings";
type Category = "All skills" | "Design" | "Technology" | "Languages" | "Creative";

const categories: Category[] = ["All skills", "Design", "Technology", "Languages", "Creative"];
const navSections: { name: Section; icon: typeof Compass }[] = [
  { name: "Discover", icon: Compass },
  { name: "My exchanges", icon: ArrowDownUp },
  { name: "Saved", icon: Bookmark },
  { name: "Messages", icon: MessageSquare },
];
const avatarColors = ["sky", "rose", "mint", "lilac"] as const;

function toStudent(profile: Profile, index: number): SkillStudent {
  const name = profile.display_name || "Student";
  return {
    id: profile.id,
    name,
    school: profile.school || "Student community",
    teaches: profile.skills_teach,
    learns: profile.skills_learn,
    rating: 5,
    swaps: 0,
    availability: "New to SkillSwap",
    initials: name.split(/\s+/).map((part) => part[0] ?? "").slice(0, 2).join("").toUpperCase(),
    color: avatarColors[index % avatarColors.length] ?? "sky",
    bio: profile.bio,
  };
}

function Index() {
  return (
    <>
      <Toaster position="top-right" />
      <SkillSwapApp />
    </>
  );
}

function SkillSwapApp() {
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [members, setMembers] = useState<SkillStudent[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [section, setSection] = useState<Section>("Discover");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<Category>("All skills");
  const [savedOnly, setSavedOnly] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [dialog, setDialog] = useState<"profile" | "connect" | "student" | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<SkillStudent | null>(null);
  const [selectedExchange, setSelectedExchange] = useState<Exchange | null>(null);
  const [messageRows, setMessageRows] = useState<Tables<"exchange_messages">[]>([]);
  const [chatText, setChatText] = useState("");
  const [queryText, setQueryText] = useState("");
  const [busy, setBusy] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSessionUser(data.session?.user ?? null));
    const { data: authListener } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        setSessionUser(currentSession?.user ?? null);
      }
    });
    return () => authListener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let active = true;
    async function loadMemberData() {
      if (!sessionUser) {
        setProfile(null);
        setMembers([]);
        setSavedIds([]);
        setExchanges([]);
        return;
      }
      const [profileResult, membersResult, savedResult, exchangeResult] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", sessionUser.id).maybeSingle(),
        supabase.from("profiles").select("*").neq("id", sessionUser.id).limit(60),
        supabase.from("saved_students").select("student_id"),
        supabase.from("skill_exchanges").select("*").order("created_at", { ascending: false }).limit(100),
      ]);
      if (!active) return;
      if (profileResult.error || membersResult.error || savedResult.error || exchangeResult.error) {
        toast.error("We couldn't refresh your student data. Please try again.");
      }
      setProfile(profileResult.data ?? null);
      setMembers((membersResult.data ?? []).map((row, index) => toStudent(row, index)));
      setSavedIds((savedResult.data ?? []).map((row) => row.student_id));
      setExchanges(exchangeResult.data ?? []);
    }
    void loadMemberData();
    return () => { active = false; };
  }, [sessionUser]);

  useEffect(() => {
    let active = true;
    async function loadMessages() {
      if (!selectedExchange) {
        setMessageRows([]);
        return;
      }
      const { data, error } = await supabase.from("exchange_messages").select("*")
        .eq("exchange_id", selectedExchange.id).order("created_at", { ascending: true });
      if (!active) return;
      if (error) toast.error("Messages couldn't be loaded.");
      setMessageRows(data ?? []);
    }
    void loadMessages();
    return () => { active = false; };
  }, [selectedExchange]);

  const allStudents = useMemo(() => [...demoStudents, ...members], [members]);
  const foundStudents = useMemo(() => filterStudents(allStudents, search, category)
    .filter((student) => !savedOnly || savedIds.includes(student.id)),
  [allStudents, category, savedIds, savedOnly, search]);
  const exchangesById = useMemo(() => new Map(allStudents.map((student) => [student.id, student])), [allStudents]);
  const pendingCount = exchanges.filter((exchange) => exchange.status === "pending" && exchange.recipient_id === sessionUser?.id).length;

  async function toggleSaved(student: SkillStudent) {
    if (!sessionUser) {
      setAuthOpen(true);
      return;
    }
    if (student.demo) {
      toast("This is an example student profile.");
      return;
    }
    const isSaved = savedIds.includes(student.id);
    const result = isSaved
      ? await supabase.from("saved_students").delete().eq("student_id", student.id)
      : await supabase.from("saved_students").insert({ owner_id: sessionUser.id, student_id: student.id });
    if (result.error) {
      toast.error("That student couldn't be saved right now.");
      return;
    }
    setSavedIds((current) => isSaved ? current.filter((id) => id !== student.id) : [...current, student.id]);
    toast.success(isSaved ? "Removed from your saved students" : "Saved for later");
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionUser || !profile) return;
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const update = {
      display_name: String(form.get("displayName") ?? "").trim() || "Student",
      school: String(form.get("school") ?? "").trim(),
      bio: String(form.get("bio") ?? "").trim(),
      skills_teach: profileSkills(String(form.get("teaches") ?? "")),
      skills_learn: profileSkills(String(form.get("learns") ?? "")),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase.from("profiles").update(update).eq("id", sessionUser.id).select().single();
    setBusy(false);
    if (error) {
      toast.error("Your profile couldn't be saved. Please try again.");
      return;
    }
    setProfile(data);
    setDialog(null);
    toast.success("Your profile is up to date");
  }

  async function sendExchange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sessionUser || !selectedStudent || !profile) {
      setAuthOpen(true);
      return;
    }
    if (selectedStudent.demo) {
      toast("Example students can't receive exchange requests.");
      return;
    }
    if (!profile.skills_teach.length || !profile.skills_learn.length) {
      setDialog("profile");
      toast("Add a skill you can teach and a skill you want to learn first.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.from("skill_exchanges").insert({
      requester_id: sessionUser.id,
      recipient_id: selectedStudent.id,
      skill_offered: profile.skills_teach[0] ?? "A skill I know",
      skill_requested: selectedStudent.teaches[0] ?? profile.skills_learn[0] ?? "A new skill",
      message: queryText.trim(),
    }).select().single();
    setBusy(false);
    if (error) {
      toast.error("The exchange request couldn't be sent.");
      return;
    }
    setExchanges((current) => [data, ...current]);
    setDialog(null);
    setQueryText("");
    toast.success("Your skill swap request was sent");
  }

  async function updateExchangeStatus(exchange: Exchange, status: string) {
    const { data, error } = await supabase.from("skill_exchanges")
      .update({ status, updated_at: new Date().toISOString() }).eq("id", exchange.id).select().single();
    if (error) {
      toast.error("The exchange couldn't be updated.");
      return;
    }
    setExchanges((current) => current.map((item) => item.id === exchange.id ? data : item));
    setSelectedExchange(data);
    toast.success(status === "accepted" ? "Exchange accepted" : status === "declined" ? "Request declined" : "Exchange updated");
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = chatText.trim();
    if (!sessionUser || !selectedExchange || !body) return;
    const { data, error } = await supabase.from("exchange_messages")
      .insert({ exchange_id: selectedExchange.id, sender_id: sessionUser.id, body }).select().single();
    if (error) {
      toast.error("Your message couldn't be sent.");
      return;
    }
    setMessageRows((current) => [...current, data]);
    setChatText("");
  }

  async function signOut() {
    await supabase.auth.signOut();
    setSection("Discover");
    toast.success("Signed out of SkillSwap");
  }

  function selectSection(next: Section) {
    setSection(next);
    setSavedOnly(next === "Saved");
    setSelectedExchange(null);
    if (next === "Discover" || next === "Saved") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  const currentName = profile?.display_name || sessionUser?.user_metadata?.["display_name"] || sessionUser?.email?.split("@")[0] || "Student";

  return (
    <div className="sw-app-shell">
      <aside className="sw-sidebar">
        <div className="sw-brand"><span className="sw-brand-mark">↕</span><span>skill<span>swap</span></span></div>
        <p className="sw-side-label">Workspace</p>
        <nav className="sw-nav-list" aria-label="Workspace">
          {navSections.map(({ name, icon: Icon }) => (
            <Button key={name} variant="ghost" className={`sw-nav-item${section === name || (name === "Saved" && savedOnly) ? " is-active" : ""}`} onClick={() => selectSection(name)}>
              <Icon aria-hidden="true" /> <span>{name}</span>
              {name === "My exchanges" && exchanges.length > 0 && <span className="sw-nav-count">{exchanges.length}</span>}
              {name === "Messages" && pendingCount > 0 && <span className="sw-nav-count">{pendingCount}</span>}
            </Button>
          ))}
        </nav>
        <p className="sw-side-label sw-side-label-account">Your account</p>
        <nav className="sw-nav-list" aria-label="Your account">
          <Button variant="ghost" className={`sw-nav-item${section === "My profile" ? " is-active" : ""}`} onClick={() => sessionUser ? setDialog("profile") : setAuthOpen(true)}><UserRound aria-hidden="true"/><span>My profile</span></Button>
          <Button variant="ghost" className={`sw-nav-item${section === "Settings" ? " is-active" : ""}`} onClick={() => sessionUser ? setSection("Settings") : setAuthOpen(true)}><Settings2 aria-hidden="true"/><span>Settings</span></Button>
        </nav>
        <div className="sw-sidebar-bottom">
          <div className="sw-sidebar-note"><Sparkles aria-hidden="true"/><span>Better together</span><small>Learn something new this week.</small></div>
          {sessionUser ? (
            <div className="sw-user-mini"><Avatar student={{ initials: currentName.slice(0, 2).toUpperCase(), color: "sky" }} /><div className="sw-user-mini-copy"><strong>{currentName}</strong><span>{profile?.school || "Student account"}</span></div><Button variant="ghost" size="icon" aria-label="Sign out" title="Sign out" onClick={() => void signOut()}><LogOut /></Button></div>
          ) : <Button className="sw-sign-in-rail" variant="outline" onClick={() => setAuthOpen(true)}>Sign in</Button>}
        </div>
      </aside>

      <div className="sw-main-column">
        <header className="sw-topbar">
          <div className="sw-breadcrumb"><span>Workspace</span><span className="sw-breadcrumb-slash">/</span><strong>{savedOnly ? "Saved" : section}</strong></div>
          <div className="sw-topbar-actions">
            {!sessionUser && <Button variant="outline" size="sm" onClick={() => setAuthOpen(true)}>Sign in</Button>}
            <Button variant="ghost" size="icon" aria-label="About SkillSwap" title="About SkillSwap" onClick={() => toast("A student community for learning both ways.")}><CircleHelp /></Button>
            <Button variant="ghost" size="icon" aria-label="Messages" title="Messages" onClick={() => selectSection("Messages")}><UsersRound /></Button>
            <Button variant="ghost" className="sw-account-trigger" onClick={() => sessionUser ? setSection("Settings") : setAuthOpen(true)}>{sessionUser ? currentName : "Account"}</Button>
          </div>
        </header>

        <main className="sw-main-content">
          {section === "Discover" || section === "Saved" ? (
            <>
              <section className="sw-hero" aria-label="SkillSwap community">
                <div className="sw-hero-copy">
                  <span className="sw-hero-eyebrow"><Sparkles aria-hidden="true" /> A community that learns both ways</span>
                  <h1>Your next skill is one conversation away.</h1>
                  <p>Trade what you know for what you want to learn. No fees, just students helping students.</p>
                  <div className="sw-hero-actions"><Button className="sw-primary-button" onClick={() => { searchRef.current?.focus(); searchRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); }}>Find your match <ArrowRight /></Button><span>Free to learn. Better together.</span></div>
                </div>
                <div className="sw-hero-image-wrap"><img src={heroStudents} alt="Students learning and exploring together" width={1600} height={700} fetchPriority="high"/><div className="sw-hero-photo-count"><span className="sw-avatar-stack"><Avatar student={{ initials: "MC", color: "rose" }} small/><Avatar student={{ initials: "JR", color: "sky" }} small/><Avatar student={{ initials: "AP", color: "mint" }} small/></span><strong>2,400+ students learning</strong></div></div>
              </section>

              <div className="sw-dashboard-grid">
                <section className="sw-discovery" aria-labelledby="discover-title">
                  <div className="sw-section-heading">
                    <div><p className="sw-kicker"><Sparkles aria-hidden="true" /> {savedOnly ? "Your collection" : "Curated for you"}</p><h2 id="discover-title">{savedOnly ? "Your saved students" : "Find your skill match"}</h2><p className="sw-section-subtitle">{savedOnly ? "People you want to learn with." : "Students who can teach what you want to learn."}</p></div>
                    {profile && <Button variant="outline" className="sw-skill-filter" onClick={() => setDialog("profile")}><ArrowDownUp aria-hidden="true"/>Your skills<ChevronDown aria-hidden="true"/></Button>}
                  </div>
                  {!savedOnly && <div className="sw-search-row"><div className="sw-search-box"><Search aria-hidden="true"/><Input ref={searchRef} aria-label="Search skills, students, or schools" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search skills, students, or schools"/></div><Button variant="outline" size="icon" aria-label="Show all skills" title="Show all skills" onClick={() => { setCategory("All skills"); setSearch(""); }}><ListFilter /></Button></div>}
                  {!savedOnly && <div className="sw-category-row" aria-label="Skill categories">{categories.map((item) => <Button key={item} variant={category === item ? "default" : "outline"} className={`sw-category-chip${category === item ? " is-selected" : ""}`} onClick={() => setCategory(item)}>{item}</Button>)}</div>}
                  <div className="sw-results-count" aria-live="polite">{foundStudents.length} {foundStudents.length === 1 ? "student" : "students"}{savedOnly ? " saved" : ""}</div>
                  {foundStudents.length ? (
                    <div className="sw-student-grid">{foundStudents.map((student) => <StudentCard key={student.id} student={student} viewerTeaches={profile?.skills_teach ?? []} viewerLearns={profile?.skills_learn ?? []} saved={savedIds.includes(student.id)} onSave={() => void toggleSaved(student)} onOpen={() => { setSelectedStudent(student); setDialog("student"); }} onConnect={() => { setSelectedStudent(student); setDialog(student.demo ? "student" : "connect"); }}/>)}</div>
                  ) : <div className="sw-empty-state"><BookOpen aria-hidden="true"/><h3>{savedOnly ? "No saved students yet" : "No students found"}</h3><p>{savedOnly ? "Save someone from Discover and they’ll be here." : "Try another skill, school, or category."}</p>{savedOnly && <Button variant="outline" onClick={() => selectSection("Discover")}>Explore students</Button>}</div>}
                </section>

                <aside className="sw-insights" aria-label="Your learning activity">
                  <section className="sw-side-card sw-balance-card"><div className="sw-side-card-title"><h3>Your skill balance</h3><Button variant="ghost" size="icon" aria-label="Edit skills" title="Edit skills" onClick={() => sessionUser ? setDialog("profile") : setAuthOpen(true)}><ListFilter /></Button></div>
                    {profile ? <><button className="sw-balance-line sw-teach-line" onClick={() => setDialog("profile")}><span><UsersRound aria-hidden="true"/>You can teach</span><strong>+ Add a skill you know <ArrowRight aria-hidden="true"/></strong>{profile.skills_teach.length > 0 && <small>{profile.skills_teach.join(" · ")}</small>}</button><button className="sw-balance-line sw-learn-line" onClick={() => setDialog("profile")}><span><Heart aria-hidden="true"/>You want to learn</span><strong>+ Add a learning goal <ArrowRight aria-hidden="true"/></strong>{profile.skills_learn.length > 0 && <small>{profile.skills_learn.join(" · ")}</small>}</button></> : <><button className="sw-balance-line sw-teach-line" onClick={() => setAuthOpen(true)}><span><UsersRound aria-hidden="true"/>You can teach</span><strong>+ Add a skill you know <ArrowRight aria-hidden="true"/></strong></button><button className="sw-balance-line sw-learn-line" onClick={() => setAuthOpen(true)}><span><Heart aria-hidden="true"/>You want to learn</span><strong>+ Add a learning goal <ArrowRight aria-hidden="true"/></strong></button></>}
                  </section>
                  <section className="sw-side-card sw-week-card"><div className="sw-side-card-title"><h3>This week</h3><Button variant="ghost" size="icon" aria-label="Weekly activity"><BookOpen /></Button></div><div className="sw-week-stat"><span><i/>Your learning time</span><div className="sw-hours"><strong>3.5</strong><span>hours</span><small>+1.5 this week</small></div><div className="sw-week-days">{["M", "T", "W", "T", "F", "S", "S"].map((day, index) => <div key={`${day}-${index}`}><span>{day}</span><i className={index === 0 || index === 1 || index === 3 || index === 5 ? "is-active" : ""}/></div>)}</div></div></section>
                  <section className="sw-tip-card"><h3><Sparkles aria-hidden="true"/>Learning tip</h3><p>Small, consistent sessions can make a big difference. Try setting up one skill swap this week.</p></section>
                  {sessionUser && profile && <Button className="sw-profile-edit-link" variant="outline" onClick={() => setDialog("profile")}><Pencil aria-hidden="true"/>Edit your profile</Button>}
                </aside>
              </div>
            </>
          ) : section === "My exchanges" || section === "Messages" ? (
            <ExchangeSection section={section} exchanges={exchanges} students={exchangesById} userId={sessionUser?.id ?? ""} selected={selectedExchange} messages={messageRows} messageText={chatText} onMessageText={setChatText} onSendMessage={(event) => void sendMessage(event)} onSelect={setSelectedExchange} onStatus={(exchange, status) => void updateExchangeStatus(exchange, status)} onSignIn={() => setAuthOpen(true)} onBrowse={() => selectSection("Discover")} />
          ) : section === "Settings" ? (
            <section className="sw-simple-page"><p className="sw-kicker"><Settings2 aria-hidden="true"/>Your account</p><h1>Settings</h1><p>Manage your SkillSwap profile and sign-in.</p><div className="sw-settings-row"><div><strong>{currentName}</strong><span>{sessionUser?.email}</span></div><Button variant="outline" onClick={() => sessionUser ? void signOut() : setAuthOpen(true)}>{sessionUser ? "Sign out" : "Sign in"}</Button></div><div className="sw-settings-row"><div><strong>Student profile</strong><span>{profile?.school || "Add your school and learning goals"}</span></div><Button variant="outline" onClick={() => sessionUser ? setDialog("profile") : setAuthOpen(true)}>Edit profile</Button></div></section>
          ) : (
            <section className="sw-simple-page"><p className="sw-kicker"><UserRound aria-hidden="true"/>Your account</p><h1>My profile</h1><p>Tell students what you know and what you’re excited to learn.</p><Button className="sw-primary-button" onClick={() => sessionUser ? setDialog("profile") : setAuthOpen(true)}>{sessionUser ? "Edit your profile" : "Sign in to create a profile"}<ArrowRight/></Button></section>
          )}
        </main>
        <footer className="sw-footer">SkillSwap <span>·</span> Learn together, grow together.</footer>
      </div>

      <nav className="sw-mobile-nav" aria-label="Main navigation">
        {navSections.map(({ name, icon: Icon }) => <Button key={name} variant="ghost" className={section === name || (name === "Saved" && savedOnly) ? "is-active" : ""} onClick={() => selectSection(name)}><Icon aria-hidden="true"/><span>{name === "My exchanges" ? "Exchanges" : name}</span></Button>)}
      </nav>

      <SkillSwapAuthDialog open={authOpen} onOpenChange={setAuthOpen} onAuthenticated={() => undefined} />
      <Dialog open={dialog === "profile"} onOpenChange={(open) => setDialog(open ? "profile" : null)}>
        <DialogContent className="sw-edit-dialog"><DialogHeader><DialogTitle>Your student profile</DialogTitle><DialogDescription>Help the right learning partners find you.</DialogDescription></DialogHeader>
          {profile ? <form className="sw-profile-form" onSubmit={(event) => void saveProfile(event)}>
            <div className="sw-form-field"><Label htmlFor="profile-name">Your name</Label><Input id="profile-name" name="displayName" defaultValue={profile.display_name} required maxLength={60}/></div>
            <div className="sw-form-field"><Label htmlFor="profile-school">School</Label><Input id="profile-school" name="school" defaultValue={profile.school} placeholder="Your school or university" maxLength={100}/></div>
            <div className="sw-form-field"><Label htmlFor="profile-teaches">Skills you can teach</Label><Input id="profile-teaches" name="teaches" defaultValue={profile.skills_teach.join(", ")} placeholder="Figma, Spanish, Python"/><small>Separate skills with commas.</small></div>
            <div className="sw-form-field"><Label htmlFor="profile-learns">Skills you want to learn</Label><Input id="profile-learns" name="learns" defaultValue={profile.skills_learn.join(", ")} placeholder="Photography, public speaking"/><small>Separate skills with commas.</small></div>
            <div className="sw-form-field"><Label htmlFor="profile-bio">A little about you</Label><textarea id="profile-bio" name="bio" className="sw-textarea" defaultValue={profile.bio} placeholder="What do you love sharing with others?" maxLength={360}/></div>
            <DialogFooter className="sw-dialog-footer"><Button variant="outline" type="button" onClick={() => setDialog(null)}>Cancel</Button><Button className="sw-primary-button" disabled={busy} type="submit">{busy ? "Saving…" : "Save profile"}</Button></DialogFooter>
          </form> : <div className="sw-sign-in-prompt"><p>Sign in to add the skills you know, what you want to learn, and your school.</p><Button className="sw-primary-button" onClick={() => { setDialog(null); setAuthOpen(true); }}>Sign in or create an account</Button></div>}
        </DialogContent>
      </Dialog>
      <Dialog open={dialog === "connect"} onOpenChange={(open) => setDialog(open ? "connect" : null)}>
        <DialogContent className="sw-edit-dialog"><DialogHeader><DialogTitle>Set up a skill swap</DialogTitle><DialogDescription>Offer something you know and choose what you’d love to learn from {selectedStudent?.name}.</DialogDescription></DialogHeader>
          <form className="sw-profile-form" onSubmit={(event) => void sendExchange(event)}>
            <div className="sw-swap-pair"><div><span>You can teach</span><strong>{profile?.skills_teach[0] || "Add a skill to your profile"}</strong></div><ArrowDownUp aria-hidden="true"/><div><span>You can learn</span><strong>{selectedStudent?.teaches[0] || "A new skill"}</strong></div></div>
            <div className="sw-form-field"><Label htmlFor="swap-note">Add a note</Label><textarea id="swap-note" className="sw-textarea" value={queryText} onChange={(event) => setQueryText(event.target.value)} placeholder="Hi! I'd love to trade skills with you…" maxLength={600}/></div>
            <DialogFooter className="sw-dialog-footer"><Button variant="outline" type="button" onClick={() => setDialog(null)}>Cancel</Button><Button className="sw-primary-button" disabled={busy} type="submit">Send request <ArrowRight/></Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={dialog === "student"} onOpenChange={(open) => setDialog(open ? "student" : null)}>
        <DialogContent className="sw-edit-dialog"><DialogHeader><DialogTitle>{selectedStudent?.name}</DialogTitle><DialogDescription>{selectedStudent?.school}</DialogDescription></DialogHeader>
          {selectedStudent && <div className="sw-student-details"><Avatar student={selectedStudent}/><p>{selectedStudent.bio || "A student ready to share a skill and learn something new."}</p><div className="sw-detail-skill"><span className="sw-skill-tag sw-skill-tag-teach">Can teach</span><strong>{selectedStudent.teaches.join(", ") || "Skills coming soon"}</strong></div><div className="sw-detail-skill"><span className="sw-skill-tag sw-skill-tag-learn">Wants to learn</span><strong>{selectedStudent.learns.join(", ") || "Learning goals coming soon"}</strong></div>{selectedStudent.demo ? <p className="sw-demo-note">This is an example student profile. Sign up to discover and connect with real SkillSwap members.</p> : <Button className="sw-primary-button" onClick={() => setDialog("connect")}>Connect <ArrowRight/></Button>}</div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Avatar({ student, small = false }: { student: Pick<SkillStudent, "initials" | "color">; small?: boolean }) {
  return <span className={`sw-avatar sw-avatar-${student.color}${small ? " sw-avatar-small" : ""}`} aria-hidden="true">{student.initials}</span>;
}

function StudentCard({ student, viewerTeaches, viewerLearns, saved, onSave, onOpen, onConnect }: {
  student: SkillStudent;
  viewerTeaches: string[];
  viewerLearns: string[];
  saved: boolean;
  onSave: () => void;
  onOpen: () => void;
  onConnect: () => void;
}) {
  const match = student.demo ? [98, 94, 91, 89][demoStudents.findIndex((item) => item.id === student.id)] ?? 90 : skillMatchPercent(viewerTeaches, viewerLearns, student);
  return (
    <article className="sw-student-card">
      <div className="sw-student-top"><button className="sw-student-identity" onClick={onOpen} aria-label={`View ${student.name}'s profile`}><Avatar student={student}/><span><strong>{student.name}</strong><small>{student.school}</small></span></button><Button variant="ghost" size="icon" className={`sw-save-button${saved ? " is-saved" : ""}`} aria-label={saved ? `Unsave ${student.name}` : `Save ${student.name}`} title={saved ? "Unsave student" : "Save student"} onClick={onSave}><UsersRound aria-hidden="true"/></Button></div>
      <div className="sw-skill-lines"><div><span className="sw-skill-tag sw-skill-tag-teach">Can teach</span><strong>{student.teaches.join(", ") || "Skills coming soon"}</strong></div><div><span className="sw-skill-tag sw-skill-tag-learn">Wants to learn</span><strong>{student.learns.join(", ") || "Learning goals coming soon"}</strong></div></div>
      <div className="sw-student-meta"><span className="sw-rating"><Star aria-hidden="true" fill="currentColor"/>{student.rating.toFixed(1)} <small>({student.swaps} swaps)</small></span><span><Clock3 aria-hidden="true"/>{student.availability}</span>{student.demo && <span className="sw-demo-label">Example</span>}</div>
      <div className="sw-card-bottom"><strong>{student.demo ? match : `${match}%`} skill match</strong><Button className="sw-card-connect" onClick={onConnect}>{student.demo ? "View example" : "Connect"} <ArrowRight aria-hidden="true"/></Button></div>
    </article>
  );
}

function ExchangeSection({ section, exchanges, students, userId, selected, messages, messageText, onMessageText, onSendMessage, onSelect, onStatus, onSignIn, onBrowse }: {
  section: "My exchanges" | "Messages";
  exchanges: Exchange[];
  students: Map<string, SkillStudent>;
  userId: string;
  selected: Exchange | null;
  messages: Tables<"exchange_messages">[];
  messageText: string;
  onMessageText: (value: string) => void;
  onSendMessage: (event: FormEvent<HTMLFormElement>) => void;
  onSelect: (exchange: Exchange | null) => void;
  onStatus: (exchange: Exchange, status: string) => void;
  onSignIn: () => void;
  onBrowse: () => void;
}) {
  const [view, setView] = useState<"incoming" | "sent" | "all">("all");
  const visibleExchanges = exchanges.filter((exchange) => view === "all" || (view === "incoming" ? exchange.recipient_id === userId : exchange.requester_id === userId));
  const activeStudent = selected ? students.get(selected.requester_id === userId ? selected.recipient_id : selected.requester_id) : undefined;
  return (
    <section className="sw-simple-page sw-exchanges-page"><div className="sw-exchange-heading"><div><p className="sw-kicker"><ArrowDownUp aria-hidden="true"/>{section === "Messages" ? "Keep learning together" : "Your learning journey"}</p><h1>{section === "Messages" ? "Messages" : "My exchanges"}</h1><p>{section === "Messages" ? "Conversations with your skill-swap partners." : "Manage the skills you’re trading with students."}</p></div>{section === "My exchanges" && <div className="sw-exchange-filters">{(["all", "incoming", "sent"] as const).map((value) => <Button key={value} variant={view === value ? "default" : "outline"} className={view === value ? "is-selected" : ""} onClick={() => setView(value)}>{value === "all" ? "All" : value === "incoming" ? "Received" : "Sent"}</Button>)}</div>}</div>
      {!userId ? <div className="sw-empty-state"><UsersRound aria-hidden="true"/><h3>Find your learning partners</h3><p>Sign in to manage exchanges and keep up with your messages.</p><Button className="sw-primary-button" onClick={onSignIn}>Sign in or join <ArrowRight/></Button></div> : visibleExchanges.length === 0 ? <div className="sw-empty-state"><MessageSquare aria-hidden="true"/><h3>No exchanges yet</h3><p>Find a student to start your first skill swap.</p><Button variant="outline" onClick={onBrowse}>Browse students</Button></div> : (
        <div className="sw-exchange-layout"><div className="sw-exchange-list">{visibleExchanges.map((exchange) => {
          const member = students.get(exchange.requester_id === userId ? exchange.recipient_id : exchange.requester_id);
          return <button key={exchange.id} className={`sw-exchange-row${selected?.id === exchange.id ? " is-current" : ""}`} onClick={() => onSelect(exchange)}><Avatar student={member ?? { initials: "SS", color: "sky" }}/><span className="sw-exchange-copy"><strong>{member?.name ?? "SkillSwap student"}</strong><small>{exchange.skill_offered} for {exchange.skill_requested}</small><span className={`sw-status-pill sw-status-${exchange.status}`}>{exchange.status}</span></span><ArrowRight aria-hidden="true"/></button>;
        })}</div>
        {selected ? <div className="sw-conversation"><div className="sw-conversation-header"><Avatar student={activeStudent ?? { initials: "SS", color: "sky" }}/><span><strong>{activeStudent?.name ?? "SkillSwap student"}</strong><small>{selected.skill_offered} ↔ {selected.skill_requested}</small></span><span className={`sw-status-pill sw-status-${selected.status}`}>{selected.status}</span></div><div className="sw-conversation-body">
          {selected.message && <div className={`sw-chat-bubble${selected.requester_id === userId ? " is-mine" : ""}`}><span className="sw-chat-sender">{selected.requester_id === userId ? "You" : activeStudent?.name ?? "Student"}</span>{selected.message}</div>}
          {messages.map((message) => <div key={message.id} className={`sw-chat-bubble${message.sender_id === userId ? " is-mine" : ""}`}><span className="sw-chat-sender">{message.sender_id === userId ? "You" : activeStudent?.name ?? "Student"}</span>{message.body}</div>)}
          {messages.length === 0 && !selected.message && <p className="sw-chat-first">Say hello and start planning your swap.</p>}
        </div><form className="sw-message-form" onSubmit={onSendMessage}><Input aria-label="Write a message" value={messageText} onChange={(event) => onMessageText(event.target.value)} placeholder="Write a message…"/><Button className="sw-primary-button" type="submit" disabled={!messageText.trim()} aria-label="Send message"><ArrowRight/></Button></form>
          {selected.status === "pending" && selected.recipient_id === userId && <div className="sw-response-actions"><Button variant="outline" onClick={() => onStatus(selected, "declined")}>Decline</Button><Button className="sw-primary-button" onClick={() => onStatus(selected, "accepted")}><Check/>Accept swap</Button></div>}
          {selected.status === "pending" && selected.requester_id === userId && <div className="sw-response-actions"><Button variant="outline" onClick={() => onStatus(selected, "cancelled")}>Cancel request</Button><span>Waiting for a reply</span></div>}
          {selected.status === "accepted" && <div className="sw-response-actions"><span>Keep in touch to arrange your first session.</span></div>}
        </div> : <div className="sw-exchange-select-hint"><Mail aria-hidden="true"/><p>Choose an exchange to view its conversation.</p></div>}</div>
      )}
    </section>
  );
}
