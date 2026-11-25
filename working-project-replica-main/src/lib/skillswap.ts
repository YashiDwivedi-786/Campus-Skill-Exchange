export type SkillStudent = {
  id: string;
  name: string;
  school: string;
  teaches: string[];
  learns: string[];
  rating: number;
  swaps: number;
  availability: string;
  initials: string;
  color: string;
  demo?: boolean;
  bio?: string;
};

export const demoStudents: SkillStudent[] = [
  {
    id: "demo-maya",
    name: "Maya Chen",
    school: "Northwestern University",
    teaches: ["Figma & UI design"],
    learns: ["Python basics"],
    rating: 4.9,
    swaps: 12,
    availability: "Available this week",
    initials: "MC",
    color: "sky",
    demo: true,
    bio: "I love turning a blank canvas into something useful. Happy to trade design tips for a little Python help.",
  },
  {
    id: "demo-jordan",
    name: "Jordan Rivera",
    school: "UCLA",
    teaches: ["Conversational Spanish"],
    learns: ["Video editing"],
    rating: 5.0,
    swaps: 8,
    availability: "Available this week",
    initials: "JR",
    color: "rose",
    demo: true,
    bio: "Native Spanish speaker, curious filmmaker. Let's practice a conversation and make something together.",
  },
  {
    id: "demo-amir",
    name: "Amir Patel",
    school: "Georgia Tech",
    teaches: ["Python & web development"],
    learns: ["Public speaking"],
    rating: 4.8,
    swaps: 16,
    availability: "Available this week",
    initials: "AP",
    color: "mint",
    demo: true,
    bio: "CS student building small web projects and looking for a friendly public-speaking practice partner.",
  },
  {
    id: "demo-sofia",
    name: "Sofia Williams",
    school: "Parsons School of Design",
    teaches: ["Illustration & branding"],
    learns: ["Photography"],
    rating: 4.7,
    swaps: 9,
    availability: "Availability on request",
    initials: "SW",
    color: "lilac",
    demo: true,
    bio: "Illustrator and brand storyteller; learning to see the world through a camera lens.",
  },
];

export function filterStudents(
  students: SkillStudent[],
  search: string,
  category: string,
): SkillStudent[] {
  const term = search.trim().toLocaleLowerCase();
  return students.filter((student) => {
    const matchesTerm = !term ||
      [student.name, student.school, ...student.teaches, ...student.learns]
        .some((value) => value.toLocaleLowerCase().includes(term));
    const matchesCategory = category === "All skills" ||
      [...student.teaches, ...student.learns].some((skill) => {
        const value = skill.toLocaleLowerCase();
        if (category === "Design") return /design|figma|illustrat|brand/.test(value);
        if (category === "Technology") return /python|web|code|tech/.test(value);
        if (category === "Languages") return /spanish|language|conversation/.test(value);
        if (category === "Creative") return /video|photo|illustrat|brand|design/.test(value);
        return true;
      });
    return matchesTerm && matchesCategory;
  });
}

export function skillMatchPercent(
  viewerTeaches: string[],
  viewerLearns: string[],
  student: Pick<SkillStudent, "teaches" | "learns">,
): number {
  const teachSet = new Set(viewerTeaches.map((skill) => skill.trim().toLocaleLowerCase()));
  const learnSet = new Set(viewerLearns.map((skill) => skill.trim().toLocaleLowerCase()));
  const incoming = student.teaches.filter((skill) => learnSet.has(skill.trim().toLocaleLowerCase())).length;
  const outgoing = student.learns.filter((skill) => teachSet.has(skill.trim().toLocaleLowerCase())).length;
  const total = learnSet.size + teachSet.size;
  if (total === 0) return 0;
  return Math.round(((incoming + outgoing) / total) * 100);
}

export function profileSkills(value: string): string[] {
  return [...new Set(value.split(",").map((skill) => skill.trim()).filter(Boolean))];
}