#!/usr/bin/env python3
"""Generate the seed data the baseline classifier is trained on.

The training set mixes template combinations (lots of phrasing variety) with
hand-written sentences. The evaluation set is hand-written only and never
shares a sentence with the training set, so the accuracy number in the tests
is an honest estimate on unseen phrasing.

Run from the repo root:  python3 tools/generate_seed_data.py
"""
import json
import random
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "JournalKit/Sources/JournalKit/Resources"
rng = random.Random(42)

# --- tasks: concrete, short-horizon actions -------------------------------
TASK_PREFIXES = [
    "I need to", "I have to", "Remember to", "Don't forget to", "I should",
    "I've got to", "I must", "Need to", "I gotta", "Make sure I", "Got to",
    "I still need to", "Tomorrow I have to", "Note to self,", "Reminder to",
]
TASK_ACTIONS = [
    "call mom", "email the landlord", "buy groceries", "pick up the dry cleaning",
    "book a dentist appointment", "pay the electricity bill", "submit the expense report",
    "renew my passport", "send the invoice to the client", "fix the leaking tap",
    "clean the kitchen", "reply to Sarah's message", "schedule the team meeting",
    "finish the slide deck", "return the library books", "water the plants",
    "order a birthday gift for dad", "cancel the gym trial", "update my resume",
    "back up my laptop", "file the taxes", "get the car serviced", "pack for the trip",
    "prepare notes for the interview", "follow up with the recruiter", "buy milk",
    "text Raj about the weekend", "drop off the parcel", "review the contract",
    "book flights for December", "take out the trash", "refill my prescription",
]
TASK_TIMES = [
    "tomorrow", "today", "tonight", "by Friday", "this afternoon", "before Monday",
    "first thing in the morning", "this weekend", "later today", "next week",
    "at 5 pm", "on Tuesday", "", "", "", "",
]
TASK_EXTRA = [
    "Call the bank tomorrow morning about the card.",
    "Pick up the kids at 3.",
    "Buy a charger before the trip.",
    "Meeting with Alex at 10 tomorrow, need to prepare the agenda.",
    "Groceries: eggs, bread and coffee.",
    "Pay rent by the first.",
    "Have to send the report to my manager tonight.",
    "Reply to the HOA email.",
    "Get a haircut this week.",
    "Book the restaurant for Saturday.",
    "To do: renew car insurance.",
    "Gotta finish the laundry tonight.",
    "Ask Priya for the presentation file.",
    "Make a doctor's appointment for next week.",
    "Return the Amazon package by Thursday.",
]

# --- skills: abilities being built or practised ---------------------------
SKILL_PREFIXES = [
    "I want to learn", "I want to get better at", "I'm trying to improve my",
    "I should practice", "I've been practicing", "I'd like to learn",
    "I need to work on my", "I started learning", "I want to master", "I'm studying",
    "I want to improve at", "I'm taking a course on", "I watched a tutorial on",
    "I really want to get good at", "I'm working on my", "I want to sharpen my",
    "I've been learning", "I want to build my skills in",
]
SKILLS = [
    "Spanish", "public speaking", "guitar", "Python", "cooking", "drawing",
    "negotiation", "SwiftUI", "data analysis", "photography", "chess",
    "touch typing", "writing", "time management", "machine learning", "piano",
    "swimming", "active listening", "video editing", "statistics", "sketching",
    "Excel", "leadership", "meditation", "Japanese", "storytelling", "design",
    "coding interviews", "sales calls", "giving feedback",
]
SKILL_SUFFIXES = ["", "", "", " every day", " a bit more", " after work", " on weekends", " daily"]
SKILL_EXTRA = [
    "Practiced scales on the piano for twenty minutes.",
    "I'm getting better at staying calm in meetings.",
    "Did a Duolingo lesson in Spanish.",
    "I learned how to use pivot tables today.",
    "I need more practice presenting to big groups.",
    "My Swift skills are improving.",
    "I want to understand how neural networks actually work.",
    "Worked through a chapter of the statistics book.",
    "My handstand is getting more stable with practice.",
    "I struggled with the negotiation, I need to get better at it.",
    "Took a pottery class and loved it.",
    "Practicing mindful breathing for focus.",
    "I'd like to be able to cook without recipes.",
    "Spent an hour on LeetCode problems.",
    "I keep improving my writing by journaling every day.",
]

# --- goals: long-horizon outcomes ----------------------------------------
GOAL_PREFIXES = [
    "My goal is to", "Someday I want to", "One day I'd love to", "In five years I want to",
    "Eventually I want to", "My dream is to", "Long term, I want to",
    "By next year I want to", "Within three years I hope to", "I aspire to",
    "This year my goal is to", "I'd love to one day", "My big goal is to",
    "Over the next few years I want to", "Before I turn forty I want to",
    "My long-term plan is to", "By the end of the decade I want to",
]
GOALS = [
    "run a marathon", "buy a house", "start my own company", "become a senior engineer",
    "travel to Japan", "write a book", "retire early", "be financially independent",
    "move to a new city", "launch my own app", "become a manager", "get my pilot's license",
    "build a strong family", "lose twenty pounds", "save fifty thousand dollars",
    "be fluent in French", "get a master's degree", "open a cafe", "pay off my student loans",
    "live by the beach", "become a better father", "hike to Everest base camp",
    "change careers into design", "build a business that runs without me",
    "own a rental property", "visit every continent",
]
GOAL_EXTRA = [
    "I see myself leading a product team in a few years.",
    "The dream is a small farmhouse with a garden.",
    "Financial freedom by 45 is the plan.",
    "I want my life to be about building things that help people.",
    "Long term I'd like to split my time between India and Canada.",
    "One day this side project could become a real company.",
    "I hope to be debt free in three years.",
    "Big picture, I want to be healthy enough to play with my grandkids.",
    "I want to be the kind of person who finishes what they start.",
    "Ten years from now I'd like to be running my own studio.",
    "My vision is to retire on a boat.",
    "I'm determined to complete an Ironman someday.",
]

# --- none: reflections, feelings, events (not actionable) ----------------
NONE_SENTENCES = [
    "Today was a long day at work.", "I felt pretty anxious this morning.",
    "The weather was beautiful.", "I had lunch with Priya and we laughed a lot.",
    "I'm grateful for my friends.", "Work was stressful but okay.",
    "I slept badly last night.", "The meeting went better than expected.",
    "I went for a walk in the park.", "Mom called and we talked for an hour.",
    "I'm feeling tired.", "Dinner was great.", "I watched a movie with my partner.",
    "It rained all afternoon.", "The kids were in a good mood.",
    "I felt proud of how I handled the call.", "Traffic was terrible on the way home.",
    "I'm a bit overwhelmed right now.", "Coffee with Sam was fun.",
    "The new office is nice.", "I had a lazy Sunday.", "I feel calm tonight.",
    "My back hurts a little.", "We celebrated Anna's birthday.",
    "The team shipped the release.", "I spent the evening reading.",
    "It was a quiet day.", "I'm thankful for my health.",
    "I got some good news from my sister.", "The sunset was amazing.",
    "I was frustrated with the delays.", "Lunch was a sandwich at my desk.",
    "Nothing much happened today.", "I felt lonely in the evening.",
    "The gym was crowded.", "My manager gave me positive feedback.",
    "I'm happy with how the week went.", "I cooked pasta for dinner.",
    "The flight was delayed by two hours.", "I caught up with an old friend.",
    "I felt motivated after the workout.", "The house is finally clean.",
    "I'm worried about the project deadline.", "We played board games tonight.",
    "I listened to a great podcast.", "It's been a weird week.",
    "My energy was low after lunch.", "I really enjoyed the concert.",
    "The dog was super playful today.", "Honestly I just feel grateful.",
]
# Short spoken fragments ("Long day.") are common in dictation and carry no action.
NONE_FRAGMENTS = [
    "Long day.", "Busy day.", "Rough morning.", "Great dinner.", "Good workout.",
    "Lazy evening.", "Tough week.", "Nice weather.", "Big meeting today.", "Slow afternoon.",
    "Long week.", "Fun night.", "Quiet morning.", "Crazy day at work.", "Good chat with Dad.",
    "Bad sleep.", "Lovely walk.", "Long drive home.", "Hectic morning.", "Easy day.",
]
NONE_TEMPLATES = ["{t} I felt {e}.", "{t} was {e2}.", "I'm feeling {e} {t2}."]
TIMES_NONE = ["Today", "This morning", "Tonight", "Yesterday", "This week", "The afternoon"]
EMOTIONS = ["happy", "tired", "stressed", "relaxed", "grateful", "anxious", "content", "restless", "hopeful", "drained"]
EMOTIONS2 = ["great", "rough", "productive", "slow", "fun", "exhausting", "peaceful", "busy"]

# --- hand-written evaluation set (never used for training) ---------------
EVAL = {
    "task": [
        "I have to call the plumber first thing tomorrow.",
        "Don't let me forget to send Mike the photos.",
        "Remind me to pay the credit card bill on Friday.",
        "Need to pick up Lily from school at three.",
        "I should email the professor about the extension tonight.",
        "Buy batteries and dish soap on the way home.",
        "I must finish the budget spreadsheet before the meeting.",
        "Tomorrow I need to drop the car at the mechanic.",
        "Gotta reply to the landlord about the lease.",
        "I need to book a table for mom's birthday dinner.",
        "Remember to cancel the Netflix subscription.",
        "I have to submit my timesheet by end of day.",
        "Schedule a call with the accountant next week.",
        "I need to clean out the fridge this weekend.",
        "Make sure I print the boarding passes tonight.",
        "Have to renew the parking permit on Monday.",
        "I need to text Jordan back.",
        "Order new running shoes before Saturday.",
        "I should return the jacket to the store.",
        "Need to prepare the slides for Thursday's demo.",
    ],
    "skill": [
        "I want to get much better at speaking in front of people.",
        "I've been practicing guitar chords every evening.",
        "I'd like to learn how to code in Rust.",
        "I'm trying to improve my German pronunciation.",
        "I really need to work on my listening skills.",
        "I started learning watercolor painting.",
        "I want to master making sourdough bread.",
        "I'm studying for better SQL skills.",
        "I should practice my interview answers more.",
        "Took an online course on UX research.",
        "I want to get good at managing my time.",
        "I'm learning to play the violin.",
        "I want to improve my chess openings.",
        "Watched a tutorial on color grading videos.",
        "I'd love to learn how to dance salsa properly.",
        "I keep practicing my handwriting.",
        "I want to build my skills in public relations.",
        "Working on my patience with the kids.",
        "I want to learn to swim properly this summer.",
        "I'm getting better at estimating project timelines.",
    ],
    "goal": [
        "My goal is to own a home before I'm thirty five.",
        "Someday I want to sail around the world.",
        "In ten years I'd like to run my own consulting firm.",
        "One day I want to publish a novel.",
        "My dream is to become a pilot.",
        "Eventually I hope to move to New Zealand.",
        "I aspire to become a CTO.",
        "Long term I want to be completely debt free.",
        "By next year I want to have a six month emergency fund.",
        "I'd love to one day build a school in my village.",
        "Within five years I want to be a principal engineer.",
        "My big dream is to climb Kilimanjaro.",
        "Over the next decade I want to build real wealth.",
        "This year my goal is to get promoted.",
        "Before I turn fifty I want to visit fifty countries.",
        "I want to eventually retire in Portugal.",
        "My long-term plan is to start a nonprofit.",
        "I hope to someday run a successful restaurant.",
        "My goal for the future is to have a healthy, happy family.",
        "In a few years I'd love to launch a startup.",
    ],
    "none": [
        "Today felt really long and heavy.",
        "I had a nice chat with my neighbour.",
        "The pizza we ordered was cold.",
        "I'm grateful the kids are healthy.",
        "Work was chaotic but we got through it.",
        "I couldn't sleep last night.",
        "We went to the beach and it was lovely.",
        "I felt a bit sad this evening.",
        "My brother visited us today.",
        "The presentation went well.",
        "It snowed for the first time this year.",
        "I'm in a good mood.",
        "Spent the day at home relaxing.",
        "The new cafe downtown is cozy.",
        "I was annoyed at the meeting running late.",
        "Had a great workout this morning.",
        "Dad told funny stories at dinner.",
        "The train was packed.",
        "I'm proud of my progress this month.",
        "Honestly today was just okay.",
    ],
}


def gen(prefixes, items, suffixes, n):
    out = set()
    while len(out) < n:
        p, i, s = rng.choice(prefixes), rng.choice(items), rng.choice(suffixes)
        sentence = f"{p} {i}{s}".strip()
        if not sentence.endswith("."):
            sentence += "."
        out.add(sentence[0].upper() + sentence[1:])
    return sorted(out)


def main():
    train = []
    tasks = gen(TASK_PREFIXES, TASK_ACTIONS, [""] + [" " + t for t in TASK_TIMES if t], 160)
    skills = gen(SKILL_PREFIXES, SKILLS, SKILL_SUFFIXES, 160)
    goals = gen(GOAL_PREFIXES, GOALS, [""], 160)
    none = set(NONE_SENTENCES) | set(NONE_FRAGMENTS)
    while len(none) < 160:
        tpl = rng.choice(NONE_TEMPLATES)
        none.add(tpl.format(t=rng.choice(TIMES_NONE), e=rng.choice(EMOTIONS),
                            e2=rng.choice(EMOTIONS2), t2=rng.choice(["today", "tonight", "right now", "lately"])))
    for label, rows in [("task", tasks + TASK_EXTRA), ("skill", skills + SKILL_EXTRA),
                        ("goal", goals + GOAL_EXTRA), ("none", sorted(none))]:
        train += [{"text": t, "label": label} for t in rows]

    eval_rows = [{"text": t, "label": label} for label, rows in EVAL.items() for t in rows]
    overlap = {r["text"] for r in train} & {r["text"] for r in eval_rows}
    assert not overlap, overlap

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "seed_training.json").write_text(json.dumps(train, indent=1) + "\n")
    (OUT / "seed_evaluation.json").write_text(json.dumps(eval_rows, indent=1) + "\n")
    print(f"train={len(train)} eval={len(eval_rows)}")


if __name__ == "__main__":
    main()
