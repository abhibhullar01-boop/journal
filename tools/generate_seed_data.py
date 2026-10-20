#!/usr/bin/env python3
"""Generate the seed data the baseline classifier is trained on.

The training set is built from everyday phrasing the way people actually talk into a
journal: imperatives ("call the plumber"), hedges ("maybe I should..."), run-on dictation
without punctuation, fillers ("um so"), past-tense recaps that are NOT tasks ("called mom,
she's fine"), other people's plans ("she wants to move"), opinions and fragments.

Five labels: task, shopping, skill, goal, none.

Nothing here is copied from the evaluation sets (seed_evaluation.json, or the whole-entry
benchmarks in mobile/src/brain/bench), so their scores are honest estimates on unseen phrasing.

Run from the repo root:  python3 tools/generate_seed_data.py
"""
import json
import random
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "mobile/src/brain/data"
rng = random.Random(7)
PER_CLASS = 1300

# ---------------------------------------------------------------------------
# Shared pieces
# ---------------------------------------------------------------------------
PEOPLE = [
    "mom", "dad", "Ravi", "Priya", "Rohan", "Neha", "Arjun", "Simran", "Kabir", "Meera",
    "Anaya", "my sister", "my brother", "the landlord", "my manager", "the client", "Sarah",
    "Alex", "nani", "Ravi uncle", "the plumber", "the electrician", "the accountant",
    "the doctor", "HR", "the recruiter", "my boss", "Jordan", "Sam", "Aman", "Pooja",
    "the bank", "the school", "the society secretary", "the mechanic", "Vikram", "Harpreet",
]
TIMES = [
    "tomorrow", "tomorrow morning", "tomorrow evening", "tonight", "today", "this afternoon",
    "this evening", "by Friday", "on Monday", "on Tuesday", "on Wednesday", "on Thursday",
    "this Friday", "on Saturday", "on Sunday", "this weekend", "next week", "next Monday",
    "at 5", "at 6 pm", "at 10 am", "at 7:30", "at noon", "in an hour", "in 2 hours",
    "in 30 minutes", "after work", "before lunch", "after lunch", "day after tomorrow",
    "on the 1st", "by the 15th", "by the 25th", "by the end of the month", "end of day",
    "by end of day", "first thing tomorrow", "first thing in the morning", "later today",
    "later", "before the meeting", "before I leave", "asap", "right after the call",
    "before Diwali", "this week", "before the weekend", "on the way home",
]
TAILS = [
    "", "", "", "", "", "", ", it's overdue", " before I forget", ", the deadline is close",
    ", he's been waiting", ", she asked twice", " otherwise there's a late fee",
    ", it's important", " if I get time", ", ugh", " please", ", seriously this time",
    " because I keep putting it off", ", they called again", " for the trip",
]
DURATIONS = ["ten minutes", "twenty minutes", "half an hour", "an hour", "15 minutes", "two hours", "a bit"]
FILLERS = ["um ", "so ", "okay so ", "and ", "also ", "oh and ", "like ", "uh ", "ok ", "alright ", "so yeah ", "anyway ", "and then ", "plus "]

# ---------------------------------------------------------------------------
# Tasks: concrete, short-horizon actions (including appointments/events with a time)
# ---------------------------------------------------------------------------
TASK_ACTIONS = [
    "call {p}", "call {p} back", "text {p}", "message {p}", "email {p}", "reply to {p}",
    "reply to {p}'s email", "ask {p} for the file", "ask {p} about the plan", "tell {p} about the change",
    "follow up with {p}", "check in with {p}", "send {p} the photos", "send the invoice to {p}",
    "pay the phone bill", "pay the credit card bill", "pay the rent", "transfer money to the landlord",
    "pay the maid", "pay the school fees", "recharge my phone", "pay the internet bill",
    "renew the bike insurance", "renew my passport", "renew the gym membership", "renew the parking permit",
    "cancel the Prime subscription", "cancel the gym trial", "cancel the dentist appointment",
    "book a dentist appointment", "book a doctor's appointment for dad", "book the Manali tickets",
    "book flights for December", "book a table for Saturday", "book a cab to the airport",
    "book the hotel", "submit the expense report", "submit the tax forms", "submit my timesheet",
    "submit the assignment", "send the quote to {p}", "finish the slide deck", "finish the report",
    "review the contract", "review the deck", "review the PR", "prepare the agenda",
    "prepare for the interview", "prepare notes for the meeting", "update my resume",
    "update the budget sheet", "file the taxes", "file the insurance claim", "print the boarding passes",
    "sign the lease", "sign the papers", "take the files along", "collect the dry cleaning",
    "pick up the children", "pick up my daughter from tuition", "pick up mom from the station",
    "pick up the parcel", "take the car for servicing", "drop off the parcel",
    "drop the kids at school", "get the scooter serviced", "get the AC fixed", "get a haircut",
    "fix the geyser", "fix the leaking tap", "fix the bike tyre", "clean the kitchen",
    "clean out the fridge", "clean my room", "do the laundry", "iron the clothes", "repot the plants",
    "take out the trash", "shut the windows", "wash the car", "pack for the trip",
    "schedule the team meeting", "schedule a call with {p}", "reschedule the meeting",
    "set up the new laptop", "back up my phone", "back up my laptop", "install the update",
    "return the library books", "return the Myntra order", "return the jacket",
    "say sorry to {p}", "visit nani", "visit {p} in the hospital", "meet {p} for coffee",
    "talk to {p} about the switch", "confirm the booking", "register for the marathon",
    "apply for the visa", "apply for leave", "upload the documents", "link Aadhaar with PAN",
    "update the KYC at the bank", "go to the bank", "go to the post office", "check the mail",
    "charge the car", "take my medicine", "refill my prescription", "get my blood test done",
    "call Jio customer care", "call the insurance company", "call the carpenter", "call the electrician",
    "email the school about the holiday", "write the blog post", "send the wedding wishes", "wish {p} happy birthday",
    "order the anniversary cake", "order the gift for {p}", "plan the weekend trip",
    "plan dad's birthday dinner", "make the payment", "transfer money to dad", "invest the bonus",
    "start the SIP", "read the agreement before signing", "feed the dog", "take the dog to the vet",
    "get the passport photos", "call the landlord about the leak", "sort out the insurance",
    "clear my inbox", "finish the presentation", "rehearse the pitch before the meeting",
]
TASK_FRAMES = [
    "I need to {a}", "I have to {a}", "need to {a}", "have to {a}", "{A}", "{A}", "{A}", "{A}",
    "remind me to {a}", "remember to {a}", "don't forget to {a}", "don't let me forget to {a}",
    "I should {a}", "I should probably {a}", "I gotta {a}", "gotta {a}", "I've got to {a}",
    "I must {a}", "I'll {a}", "I will {a}", "I'm going to {a}", "I have to remember to {a}",
    "make sure to {a}", "make sure I {a}", "maybe {a}", "maybe I should {a}",
    "can you remind me to {a}", "note to self, {a}", "to do: {a}", "I'm supposed to {a}",
    "I promised to {a}", "I really need to {a}", "I still need to {a}", "I still have to {a}",
    "must {a}", "should {a}", "then {a}", "after that {a}", "and {a}", "also {a}",
    "I need to quickly {a}", "let me {a}", "I want to {a}", "I'd better {a}",
    "it's time to {a}", "I've been meaning to {a}", "first thing, {a}", "need to go {a}",
    "I need to remember to {a}", "can't forget to {a}", "please remind me to {a}",
    "could you remind me to {a}", "hey remind me to {a}", "set a reminder to {a}", "ping me to {a}",
    "remind me later to {a}", "pls remind me to {a}", "can you set a reminder to {a}",
]
TASK_FRONT_TIMES = [
    "Tomorrow I have to {a}", "Tomorrow morning I need to {a}", "Tonight I need to {a}",
    "Before Friday I need to {a}", "On Monday I have to {a}", "This weekend I should {a}",
    "After work I need to {a}", "In the evening {a}", "Before the meeting I have to {a}",
    "Next week I need to {a}", "Today I have to {a}", "Later today {a}",
]
TASK_EVENTS = [
    "Dentist appointment {t}", "Meeting with the CA {t} about the taxes", "Interview with TCS {t}",
    "Parent teacher meeting {t}", "Flight to Delhi {t}", "Haircut {t}", "Doctor's appointment {t}",
    "Call with the client {t}", "Team review {t}", "Gym class {t}", "Dad's birthday dinner {t}",
    "Car service {t}", "Demo for the client {t}", "Dinner with Pooja {t}", "Standup moved to {t}",
    "Payment due {t}", "Rent is due {t}", "Exam {t}", "Vet appointment {t}", "Physio session {t}",
    "Wedding in Jalandhar {t}", "Train to Amritsar {t}", "The carpenter is coming {t}",
    "Electrician is coming {t}", "Delivery arriving {t}", "Deadline for the proposal is {t}",
]
EVENT_TIMES = [
    "tomorrow at 4", "at 9:30 tomorrow", "next Tuesday at 3 pm", "on Friday", "on Saturday morning",
    "at 5 today", "this Thursday at 11", "day after tomorrow at 10", "tomorrow morning", "on the 1st",
    "next week", "tonight at 8", "on Sunday", "at 3", "by the 20th",
]
TASK_EXTRA = [
    "Call the bank tomorrow morning about the card.", "Pick up the kids at 4.",
    "Meeting with Alex at 10 tomorrow, need to prepare the agenda.", "Pay rent by the first.",
    "Have to send the report to my manager tonight.", "Get a haircut this week.",
    "Ask Priya for the presentation file.", "To do: renew car insurance.", "Gotta finish the laundry tonight.",
    "Make a doctor's appointment for next week.", "Return the Amazon package by Thursday.",
    "The tap is leaking again, call the plumber.", "Car is making a weird noise, take it to the mechanic.",
    "Mom's medicine is almost over, refill it tomorrow.", "Ping Rohan about the invoice.",
    "Remind me about the water bill on the 5th.", "Gas cylinder booking tomorrow.",
    "Send the cheque to the society office.", "Talk to the landlord about the deposit.",
    "Respond to the wedding invite.", "RSVP for Kabir's party by Friday.",
    "Fill the form for the school admission.", "Get the bike's puncture fixed.",
    "Should call grandma, haven't spoken in a week.", "Ask HR about the bonus.",
    "Must drop the cheque at the bank.", "Need to look into the credit card charges.",
    "Have to wake up early tomorrow for the flight.", "Set an alarm for 6.",
]

# ---------------------------------------------------------------------------
# Shopping: things to buy
# ---------------------------------------------------------------------------
GROCERIES = [
    "milk", "eggs", "bread", "atta", "rice", "dal", "paneer", "ghee", "onions", "tomatoes",
    "potatoes", "curd", "butter", "coffee", "tea", "sugar", "salt", "cooking oil", "bananas",
    "apples", "chicken", "maggi", "biscuits", "coriander", "green chillies", "ginger", "garlic",
    "lemons", "cheese", "yogurt", "oats", "cornflakes", "peanut butter", "jam", "honey", "spinach",
    "cucumber", "carrots", "frozen peas", "noodles", "pasta", "olive oil", "chips", "juice",
    "soft drinks", "ice cream", "chocolate", "almonds", "cashews", "besan", "poha", "masala",
    "detergent", "dish soap", "toilet paper", "tissues", "garbage bags", "toothpaste", "shampoo",
    "soap", "handwash", "light bulbs", "batteries", "mosquito repellent", "floor cleaner",
    "dog food", "cat litter", "diapers", "baby wipes", "sanitary pads", "razor blades",
]
BIG_ITEMS = [
    "trekking shoes", "a new phone charger", "headphones", "a winter jacket", "a birthday gift for dad",
    "a new mattress", "curtains for the bedroom", "a yoga mat", "a water bottle", "a new laptop bag",
    "school uniforms for the kids", "a gift for Anaya", "a phone cover", "a power bank", "a desk lamp",
    "an air purifier", "new bedsheets", "a pressure cooker", "a mixer grinder", "a kettle", "an umbrella",
    "Diwali sweets", "diyas for Diwali", "flowers for mom", "a cake for the party", "printer ink",
    "a new keyboard", "a helmet", "formal shoes", "a suit for the wedding", "a raincoat",
    "notebooks for school", "a router", "an extension cord", "a mouse", "plants for the balcony",
]
SHOP_FRAMES = [
    "buy {i}", "I need to buy {i}", "need to buy {i}", "I have to buy {i}", "need to get {i}",
    "I need to get {i}", "get {i}", "we need {i}", "we're out of {i}", "we ran out of {i}",
    "running low on {i}", "we're running low on {i}", "add {i} to the shopping list",
    "pick up {i} on the way home", "get {i} from the store", "order {i} on Amazon",
    "order {i} from Blinkit", "order {i} on Zepto", "I should buy {i}", "remember to buy {i}",
    "don't forget to buy {i}", "grab some {i}", "grab {i}", "need more {i}", "buy some {i}",
    "we don't have any {i} left", "{i} is finished", "{i} is over, need to get more",
    "I want to buy {i}", "time to buy {i}", "get some {i} for tomorrow", "pick up some {i}",
    "remind me to buy {i}", "have to get {i}", "also buy {i}", "and get {i}",
    "shopping list: {i}", "groceries: {i}", "need {i}", "out of {i}", "I'm out of {i}",
    "I should order {i}", "maybe buy {i}", "buy {i} this weekend", "buy {i} tomorrow",
    "then groceries, {i}", "groceries, we need {i}",
    "add {i} to my list", "add {i} to my shopping list", "put {i} on the shopping list",
    "can you add {i} to the list", "put {i} on my list", "add {i} please",
]
SHOP_BIG_FRAMES = [
    "I need to buy {i}", "buy {i}", "I want to buy {i}", "need to get {i}", "order {i} on Amazon",
    "I should get {i}", "I need {i}", "I need new {n}", "need new {n}", "time to buy {i}",
    "get {i} before the trip", "buy {i} this weekend", "I have to buy {i}", "maybe order {i}",
    "add {i} to the list", "I've been wanting to buy {i}", "look for {i} at the mall",
]
NEW_THINGS = ["shoes", "headphones", "bedsheets", "curtains", "glasses", "tyres", "socks", "towels", "pillows", "jeans"]

# ---------------------------------------------------------------------------
# Skills: abilities being built or practised
# ---------------------------------------------------------------------------
SKILL_NOUNS = [
    "Spanish", "French", "Punjabi", "Hindi", "German", "Japanese", "public speaking",
    "presentation skills", "guitar", "piano", "singing", "cooking", "baking", "drawing", "sketching",
    "painting", "photography", "video editing", "negotiation", "client communication", "pricing",
    "time management", "SQL", "Python", "system design", "Excel", "data analysis", "machine learning",
    "React", "Figma", "UI design", "coding", "DSA", "statistics", "writing", "storytelling",
    "chess", "swimming", "driving", "yoga", "meditation", "touch typing", "dancing", "salsa",
    "leadership", "giving feedback", "active listening", "sales calls", "investing", "budgeting",
    "personal finance", "astronomy", "gardening", "calligraphy", "handwriting", "badminton",
    "tennis", "cricket batting", "my backhand", "my serve", "my English", "my communication",
    "my posture", "interview answers", "coding interviews", "SwiftUI", "accounting", "marketing",
    "copywriting", "emotional control", "patience", "focus", "networking", "small talk",
]
SKILL_VERBS = [
    "speak French", "play the guitar", "play the tabla", "cook without recipes",
    "code in Rust", "draw portraits", "swim properly", "drive a manual car", "meditate",
    "manage my time", "say no", "edit videos", "make sourdough", "read Gurmukhi",
    "speak in front of people", "negotiate my salary", "stay calm in meetings", "write clean code",
    "use pivot tables", "do a handstand", "touch type", "sing in tune", "dance salsa",
    "make proper chai", "fix things around the house", "explain ideas clearly", "listen better",
    "manage money", "design apps", "build websites", "analyse data", "invest wisely",
    "make a budget", "take good photos", "play chess openings", "write better emails",
]
SKILL_FRAMES_N = [
    "I want to learn {s}", "I want to get better at {s}", "I need to work on {s}",
    "I've been practicing {s}", "practiced {s} for {d} today", "did {d} of {s} today",
    "I'm learning {s}", "started learning {s}", "I'm getting better at {s}",
    "I want to improve my {s}", "I should practice {s} more", "I need more practice with {s}",
    "took a {s} class today", "had my {s} lesson today", "I want to get into {s}",
    "I want to get good at {s}", "still struggling with {s}", "I'm terrible at {s}, need to work on it",
    "watched a tutorial on {s}", "I'd like to learn {s}", "I want to start learning {s}",
    "{s} practice went well today", "I'm trying to improve at {s}", "my {s} is getting better",
    "I really need to work on my {s}", "I'm taking a course on {s}", "I signed up for a {s} course",
    "I want to master {s}", "I've been learning {s}", "I need to get better at {s}",
    "I keep practicing {s}", "I want to brush up on {s}", "I want to be good at {s}",
    "working on my {s}", "learning {s} slowly", "spent {d} on {s}", "I want to sharpen my {s}",
    "my boss said I should work on my {s}", "I should get better at {s}",
    "I want to study {s}", "I'm studying {s}", "I've started {s} lessons",
    "I want to get into {s} seriously", "for that I need to get better at {s}",
    "revise {s}", "practice {s}", "practice {s} tonight", "revise {s} before the interview", "study {s}",
    "learn {s}", "learn some {s}",
]
SKILL_FRAMES_V = [
    "I want to learn how to {v}", "I want to learn to {v}", "I'm learning to {v}",
    "I'm trying to {v} every day", "I want to be able to {v} properly",
    "I need to learn how to {v}", "I'd like to learn to {v}", "I'm practicing how to {v}",
    "I want to figure out how to {v}", "learning how to {v}", "I wish I could {v}, want to learn",
    "I should learn how to {v}", "I'm slowly learning to {v}", "I should practice how to {v}",
]
SKILL_EXTRA = [
    "Practiced scales on the piano for twenty minutes.", "Did a Duolingo lesson in Spanish.",
    "I learned how to use pivot tables today.", "I need more practice presenting to big groups.",
    "My Swift skills are improving.", "I want to understand how neural networks actually work.",
    "Worked through a chapter of the statistics book.", "My handstand is getting more stable with practice.",
    "I struggled with the negotiation, I need to get better at it.", "Took a pottery class and loved it.",
    "Practicing mindful breathing for focus.", "I'd like to be able to cook without recipes.",
    "Spent an hour on LeetCode problems.", "I keep improving my writing by journaling every day.",
    "My Hindi is getting rusty, need to practice.", "Tabla is getting easier with daily practice.",
    "I want to understand the stock market better.", "Need to brush up on my Excel before the new job.",
    "I should rehearse talks out loud more.", "I freeze up on stage, need to work on that.",
    "I'm trying to do yoga every evening.", "Learning to drive is harder than I thought.",
    "My chess rating went up after practicing tactics.", "I want to know more about birds and birdwatching.",
    "Practice the guitar chords tonight.", "Doing breathing exercises daily for my singing.",
]

# ---------------------------------------------------------------------------
# Goals: long-horizon outcomes, life changes and habits to build
# ---------------------------------------------------------------------------
GOALS = [
    "run a marathon", "run a full marathon", "buy a house", "buy a flat in Mohali",
    "start my own company", "start my own architecture firm", "become a senior engineer", "travel to Japan",
    "write a book", "retire early", "be financially free", "move to Canada", "settle in Australia",
    "launch my own app", "become a manager", "move into data science", "get my pilot's license",
    "lose ten kilos", "lose twenty pounds", "save ten lakhs", "save fifty thousand dollars",
    "be fluent in French", "get a master's degree", "do an MBA", "open a cafe", "pay off my loans",
    "be debt free", "live by the beach", "become a better father", "be a better partner",
    "hike to Everest base camp", "change careers into design", "own a rental property",
    "visit every continent", "build a business that runs without me", "bench press 80 kg",
    "get a six pack", "have a farmhouse with a garden", "get promoted", "become a team lead",
    "work remotely from the mountains", "build a school in my village", "publish a novel",
    "have a big family", "take my parents on a world trip", "own a Thar", "buy my parents a house",
    "be the healthiest version of myself", "start a YouTube channel that actually grows",
    "get into a good university", "complete an Ironman", "climb Kilimanjaro", "learn to fly",
    "have a six month emergency fund", "become a CTO", "earn a crore", "retire in the hills",
    "own a small bakery", "play in a band", "buy a telescope and a cabin", "visit Iceland",
]
HABIT_GOALS = [
    "read more", "read twelve books this year", "sleep before 11", "wake up at 6 every day",
    "spend more time with family", "be more patient with the kids", "quit sugar", "drink more water",
    "get fit", "go to the gym regularly", "put money aside every month", "stop doomscrolling",
    "eat healthier", "be more consistent", "call my parents more often", "travel more",
    "stress less", "be more organised", "spend less on shopping", "cut down on coffee",
    "be more confident", "make more friends", "stop smoking", "walk 10k steps a day",
    "journal every day", "be kinder to myself", "worry less about work", "be home for dinner more",
]
GOAL_FRAMES = [
    "my goal is to {g}", "my goal this year is to {g}", "someday I want to {g}", "one day I'd love to {g}",
    "eventually I want to {g}", "long term I want to {g}", "long term I really want to {g}",
    "in five years I want to {g}", "within three years I want to {g}", "by 40 I want to {g}",
    "by next year I want to {g}", "my dream is to {g}", "I really want to {g} someday",
    "I hope to {g} one day", "the plan is to {g} in a few years", "I want to {g} before I turn 30",
    "big dream: {g}", "I'd love to {g} someday", "I'm working towards being able to {g}",
    "I'm saving up to {g}", "it would be amazing to {g} one day", "this year I want to {g}",
    "one of my goals is to {g}", "my long-term plan is to {g}", "my big goal is to {g}",
    "I aspire to {g}", "the dream is to {g}", "ten years from now I want to {g}",
    "I've always wanted to {g}", "my target is to {g}", "I'm determined to {g}",
    "I want to {g} by the end of next year", "by June I want to {g}", "my resolution is to {g}",
    "honestly I want to {g} by 45", "life goal: {g}", "I'd really like to {g} in the future",
    "maybe {g} someday", "I want to {g} for a few years",
]
HABIT_FRAMES = [
    "I want to {h}", "I really want to {h}", "my goal is to {h}", "I need to {h} in general",
    "I'm trying to {h}", "this year I want to {h}", "I want to start trying to {h}",
    "I should {h} in general", "I'd like to {h}", "I wish I could {h}", "from now on I want to {h}",
    "new rule: {h}", "my resolution is to {h}", "going forward I want to {h}",
    "I want to get back to trying to {h}", "goal for this month: {h}",
]
TARGETS = [
    "I want to get my weight down to 70.", "Want to hit 120 on the bench press.",
    "I want to reach 10k followers.", "I want to get my salary to 30 lakhs.", "I want to get my savings to 5 lakhs.",
    "Want to get my 5k time under 25 minutes.", "I want my credit score above 800.",
    "I want to get to 2000 on chess.com.", "Aiming for a band 8 in IELTS.", "Want to push it to 100.",
]
GOAL_EXTRA = [
    "I see myself leading a product team in a few years.", "The dream is a small farmhouse with a garden.",
    "Financial freedom by 45 is the plan.", "I want my life to be about building things that help people.",
    "Long term I'd like to split my time between India and Canada.", "One day this side project could become a real company.",
    "I hope to be debt free in three years.", "Big picture, I want to be healthy enough to play with my grandkids.",
    "I want to be the kind of person who finishes what they start.", "Ten years from now I'd like to be running my own studio.",
    "My vision is to retire on a boat.", "I'm determined to complete an Ironman someday.",
    "Maybe open a bookstore someday.", "I want to perform a whole set at an open mic one day.",
]

# ---------------------------------------------------------------------------
# None: reflections, feelings, events that already happened, other people's news
# ---------------------------------------------------------------------------
NONE_SENTENCES = [
    "Today was a long day at work.", "I felt pretty anxious this morning.", "The weather was beautiful.",
    "I had lunch with Priya and we laughed a lot.", "I'm grateful for my friends.", "Work was stressful but okay.",
    "I slept badly last night.", "The meeting went better than expected.", "I went for a walk in the park.",
    "Mom called and we talked for an hour.", "I'm feeling tired.", "Dinner was great.",
    "I watched a movie with my partner.", "It rained all afternoon.", "The kids were in a good mood.",
    "I felt proud of how I handled the call.", "Traffic was terrible on the way home.",
    "I'm a bit overwhelmed right now.", "Coffee with Sam was fun.", "The new office is nice.",
    "I had a lazy Sunday.", "I feel calm tonight.", "My back hurts a little.", "We celebrated Anna's birthday.",
    "The team shipped the release.", "I spent the evening reading.", "It was a quiet day.",
    "I'm thankful for my health.", "I got some good news from my sister.", "The sunset was amazing.",
    "I was frustrated with the delays.", "Lunch was a sandwich at my desk.", "Nothing much happened today.",
    "I felt lonely in the evening.", "The gym was crowded.", "My manager gave me positive feedback.",
    "I'm happy with how the week went.", "I cooked pasta for dinner.", "The flight was delayed by two hours.",
    "I caught up with an old friend.", "I felt motivated after the workout.", "The house is finally clean.",
    "I'm worried about the project deadline.", "We played board games tonight.", "I listened to a great podcast.",
    "It's been a weird week.", "My energy was low after lunch.", "I really enjoyed the concert.",
    "The dog was super playful today.", "Honestly I just feel grateful.", "I think I'm decent at it.",
    "That's the main thing.", "Big plans haha.", "Probably need a holiday.", "No idea what to do about it.",
    "It is what it is.", "I don't know.", "Ugh.", "Anyway.", "Happy about that.", "Fair enough I suppose.",
    "I get anxious.", "It calms me down.", "Got me thinking.", "Lazy day but I needed it.",
    "Bit irritated with myself.", "Just tired I guess.", "The sky is grey again.",
    "It hurts less now.", "His knee is getting worse.", "It keeps crashing.", "My CA mentioned it.",
    "Almost done with Sapiens.", "Maybe two a week.", "It's getting easier.", "Mom's fever is gone.",
    "We had a nice family dinner.", "The new intern seems sharp.", "The drive back was awful.",
    "I keep ordering Zomato.", "Spent too much on shoes this month.", "Had an argument with my sister.",
    "Clicked some nice pictures.", "Did chest and back.", "Gym was okay today.", "Thinking about it.",
    "Not bad overall.", "Could have been worse.", "Such a relief.", "Finally!", "What a day.",
    "I miss college.", "I wonder if I made the right call.", "Feeling a bit off today.",
    "The review meeting dragged on forever.", "I was exhausted but happy.",
    "I'm so sleepy.", "Weekend went by too fast.", "Can't believe it's already October.",
    "I'm not sure about the new job.", "Today I realized I need a break.", "Life feels good right now.",
    "Struggled to focus today.", "Had a headache all evening.", "Got a lot done today.",
    "The food at the wedding was amazing.", "Nani told stories about the village.",
    "We went to the gurudwara in the morning.", "Diwali shopping was chaotic.",
    "Woke up late again.", "I'm annoyed with how the day went.", "lol.", "Okay that's it for today.",
    "That's all.", "Good night.", "Whatever.", "So that happened.", "Long story.",
]
PAST_EVENTS = [
    "called mom", "paid the electricity bill", "booked the tickets", "went to the gym", "did legs at the gym",
    "watched a movie about Mars", "bought groceries", "submitted the report", "ordered pizza",
    "cleaned the whole house", "finished the slides", "met Rohan for coffee", "picked up the kids",
    "dropped the car at the garage", "fixed the router", "had a call with the client",
    "went for a run", "cooked dinner", "played cricket with the boys", "visited nani", "watched Netflix",
    "read a few chapters", "worked from home", "took the dog for a walk", "went shopping with Priya",
    "practiced for a bit", "sent the proposal", "replied to all the emails", "had lunch with the team",
    "went to the doctor", "got a haircut", "paid rent", "returned the package", "renewed the insurance",
    "talked to my manager", "attended the wedding", "drove to Ludhiana", "made chai for everyone",
    "spent the evening on the terrace", "slept in", "skipped the gym", "ate too much", "had a long nap",
    "watched a documentary", "bought a new phone", "learned a new recipe", "called the plumber",
]
PAST_FRAMES = [
    "{T} I {e}.", "I {e} {t}.", "{E} {t}.", "{E}, it was nice.", "{E}, finally.", "Already {e}.",
    "I {e} and it felt good.", "{E} and then came home.", "Finally {e}.", "I already {e}.",
    "So yeah I {e} {t}.", "{E}, feeling better now.", "We {e} {t}.", "Just {e}.",
]
PAST_TIMES = ["today", "this morning", "tonight", "yesterday", "earlier", "in the evening", "after work", "last night"]
THIRD_PERSON = [
    "She's planning to move to Dubai.", "My brother wants to buy a car.", "Rohan has to submit his thesis.",
    "Priya wants to learn salsa.", "Dad needs to get his eyes checked, he said he'll go.", "Mom wants to visit Amritsar.",
    "My sister is planning to do an MBA.", "Kabir is learning guitar.", "Neha's goal is to run a marathon.",
    "Arjun has to finish his project by Friday.", "The kids want a dog.", "My friend is moving to Canada.",
    "He said he'll call tomorrow.", "They are planning a trip to Goa.", "My manager wants the report by Monday.",
    "Simran is starting her own business.", "Mom has a doctor's appointment, dad is taking her.",
    "My cousin got into a good university.", "Ravi uncle is retiring next year.", "She wants to become a pilot.",
    "He keeps talking about buying a bike.", "Meera switched to product last year.",
]
FEELINGS = ["happy", "tired", "stressed", "relaxed", "grateful", "anxious", "content", "restless", "hopeful",
            "drained", "low", "excited", "annoyed", "calm", "overwhelmed", "lonely", "proud", "bored", "sad"]
ADJ = ["great", "rough", "productive", "slow", "fun", "exhausting", "peaceful", "busy", "weird", "okay", "long", "chill"]
NONE_TEMPLATES = [
    "{t} I felt {f}.", "{T} was {a}.", "I'm feeling {f} {w}.", "Feeling {f}.", "Kind of {f} {w}.",
    "I was so {f} {w}.", "Honestly I feel {f}.", "{T} was pretty {a}.", "It was a {a} day.",
    "Work was {a} {w}.", "The day was {a}.", "Pretty {a} day overall.", "I feel {f} about it.",
]
WHENS = ["today", "tonight", "right now", "lately", "this week", "this morning", "all day"]

# Things said TO the companion in the chat: questions and requests, not things to track.
CHAT_TOPICS = [
    "a gift for my sister", "running shoes", "a good laptop for coding", "a recipe with paneer",
    "a quick dinner idea", "a book on habits", "a nice place for dinner", "a weekend trip from Chandigarh",
    "a good movie tonight", "a workout I can do at home", "some music for focus", "a podcast about money",
    "a good mattress", "ideas for Diwali decorations", "a birthday cake shop nearby", "a phone under 20000",
    "a skincare routine", "a healthy breakfast", "a budget for this month", "ways to save money",
]
CHAT_REQUESTS = [
    "what should I focus on today", "what should I do first", "what's on my plate today", "what is on tomorrow",
    "what's left for today", "what do I need to buy", "what's on my shopping list", "how am I doing on my goals",
    "how am I doing this week", "what did I say about {p} last week", "what did I do yesterday",
    "when is the dentist appointment", "did I pay the rent", "have I called {p} this week",
    "help me plan my day", "help me plan the week", "help me wrap up the day", "help me wind down",
    "help me think this through", "help me write a message to {p}", "give me a 5 minute break idea",
    "give me some motivation", "tell me a joke", "tell me something nice", "summarise my week",
    "summarize today", "how was my week", "what should I cook tonight", "what should I eat",
    "should I learn guitar or piano", "should I take the new job", "is it a good idea to quit sugar",
    "any tips to sleep better", "any ideas for the weekend", "any suggestions for {c}",
    "can you suggest {c}", "suggest {c}", "recommend {c}", "find me {c}", "show me {c}",
    "can you find {c}", "look up {c}", "search for {c}", "where can I find {c}", "which is better for me",
    "compare these two for me", "explain how SIPs work", "how do I make dal makhani", "how do I fix a slow laptop",
    "why am I always tired", "what do you think", "what do you know about me", "can you help me",
    "can you mark the electricity bill as done", "mark the rent as paid", "clear my shopping list",
    "hi", "hey", "hello", "good morning", "good night", "thanks", "thank you", "ok cool", "okay thanks",
    "nice", "perfect", "got it", "haha", "that's helpful", "you're the best", "never mind", "yes please",
    "no that's fine", "sounds good", "tell me more", "go on", "what else",
]


# ---------------------------------------------------------------------------
# Generation helpers
# ---------------------------------------------------------------------------
def cap(s):
    return s[0].upper() + s[1:] if s else s


def finish(s):
    s = s.strip()
    if not s.endswith((".", "!", "?")):
        s += "."
    return cap(s)


def dictate(s):
    """Make it look like voice dictation some of the time: fillers, lower case, no full stop."""
    if rng.random() < 0.25:
        s = rng.choice(FILLERS) + s[0].lower() + s[1:]
    if rng.random() < 0.35:
        s = s.rstrip(".!?")
        s = s[0].lower() + s[1:]
    return s


def fill(template, **values):
    out = template
    for key, value in values.items():
        out = out.replace("{" + key + "}", value)
    return out


def action():
    return rng.choice(TASK_ACTIONS).replace("{p}", rng.choice(PEOPLE))


def task_sentence():
    r = rng.random()
    if r < 0.12:
        return finish(fill(rng.choice(TASK_EVENTS), t=rng.choice(EVENT_TIMES)))
    if r < 0.2:
        return finish(fill(rng.choice(TASK_FRONT_TIMES), a=action()))
    if r < 0.32:
        return finish(cap(action()))  # a short spoken instruction
    a = action()
    frame = rng.choice(TASK_FRAMES)
    t = rng.choice(TIMES) if rng.random() < 0.6 else ""
    s = fill(frame, a=a, A=cap(a))
    if frame.startswith("I want to") and not t:
        t = rng.choice(TIMES)  # "I want to call mom" is only a task with a time
    if t:
        s += " " + t
    s += rng.choice(TAILS)
    return finish(s)


def shopping_list():
    items = rng.sample(GROCERIES, rng.randint(2, 4))
    if rng.random() < 0.5:
        return ", ".join(items[:-1]) + " and " + items[-1]
    return " ".join(items[:-1]) + " and " + items[-1]  # dictation without commas


def shopping_sentence():
    r = rng.random()
    if r < 0.3:
        i = shopping_list()
    elif r < 0.75:
        i = rng.choice(GROCERIES)
    else:
        s = fill(rng.choice(SHOP_BIG_FRAMES), i=rng.choice(BIG_ITEMS), n=rng.choice(NEW_THINGS))
        if rng.random() < 0.25:
            s += " " + rng.choice(["this weekend", "tomorrow", "for the trip", "before Diwali", "on the way home", "soon"])
        return finish(s)
    s = fill(rng.choice(SHOP_FRAMES), i=i)
    if rng.random() < 0.2:
        s += " " + rng.choice(["on the way home", "tonight", "tomorrow", "from the market", "for the week", "for the party", "before guests come"])
    return finish(s)


def skill_sentence():
    if rng.random() < 0.7:
        s = fill(rng.choice(SKILL_FRAMES_N), s=rng.choice(SKILL_NOUNS), d=rng.choice(DURATIONS))
    else:
        s = fill(rng.choice(SKILL_FRAMES_V), v=rng.choice(SKILL_VERBS))
    if rng.random() < 0.2:
        s += rng.choice([" every day", " a bit more", " after work", " on weekends", " properly this time", ", it's fun", ", slowly getting there"])
    return finish(s)


def goal_sentence():
    r = rng.random()
    if r < 0.05:
        return rng.choice(TARGETS)
    if r < 0.3:
        return finish(fill(rng.choice(HABIT_FRAMES), h=rng.choice(HABIT_GOALS)))
    return finish(fill(rng.choice(GOAL_FRAMES), g=rng.choice(GOALS)))


def chat_request():
    s = fill(rng.choice(CHAT_REQUESTS), p=rng.choice(PEOPLE), c=rng.choice(CHAT_TOPICS))
    if s.startswith(("what", "how", "where", "which", "why", "when", "did", "have", "should", "is", "any", "can", "do")) and rng.random() < 0.7:
        s += "?"
    return cap(s)


def none_sentence():
    r = rng.random()
    if r < 0.22:
        return chat_request()
    if r < 0.45:
        return rng.choice(NONE_SENTENCES)
    if r < 0.68:
        e = rng.choice(PAST_EVENTS)
        t = rng.choice(PAST_TIMES)
        return finish(fill(rng.choice(PAST_FRAMES), e=e, E=cap(e), t=t, T=cap(t)))
    if r < 0.78:
        return rng.choice(THIRD_PERSON)
    return finish(fill(
        rng.choice(NONE_TEMPLATES),
        t=cap(rng.choice(PAST_TIMES)),
        T=cap(rng.choice(["today", "the morning", "work", "the weekend", "this week", "yesterday"])),
        f=rng.choice(FEELINGS), a=rng.choice(ADJ), w=rng.choice(WHENS),
    ))


def build(label, maker, extra, n):
    rows = set(extra)
    attempts = 0
    while len(rows) < n and attempts < n * 50:
        attempts += 1
        rows.add(dictate(maker()))
    return [{"text": t, "label": label} for t in sorted(rows)]


# ---------------------------------------------------------------------------
# Hand-written evaluation set (never used for training)
# ---------------------------------------------------------------------------
EVAL = {
    "task": [
        "I have to call the plumber first thing tomorrow.", "Don't let me forget to send Mike the photos.",
        "Remind me to pay the credit card bill on Friday.", "Need to pick up Lily from school at three.",
        "I should email the professor about the extension tonight.", "I must finish the budget spreadsheet before the meeting.",
        "Tomorrow I need to drop the car at the mechanic.", "Gotta reply to the landlord about the lease.",
        "I need to book a table for mom's birthday dinner.", "Remember to cancel the Hotstar subscription.",
        "I have to submit my timesheet by end of day.", "Schedule a call with the CA next week.",
        "I need to clean out the store room this weekend.", "Make sure I print the tickets tonight.",
        "Have to renew the society parking sticker on Monday.", "I need to text Jordan back.",
        "I should return the kurta to the store.", "Need to prepare the slides for Thursday's demo.",
        "Ring the gas agency about the cylinder.", "Parent teacher meeting at 11 on Saturday.",
    ],
    "shopping": [
        "Buy batteries and dish soap on the way home.", "We're out of coffee powder.", "Need to get bread and eggs.",
        "Order new running shoes before Saturday.", "Pick up some tomatoes and onions.",
        "Add conditioner to the shopping list.", "Running low on atta and rice.", "I need to buy a gift for Meera.",
        "Get milk tomorrow morning.", "Buy a new phone charger, mine broke.",
    ],
    "skill": [
        "I want to get much better at speaking in front of people.", "I've been practicing guitar chords every evening.",
        "I'd like to learn how to code in Go.", "I'm trying to improve my German pronunciation.",
        "I really need to work on my listening skills.", "I started learning watercolor painting.",
        "I want to master making biryani.", "I should practice my interview answers more.",
        "Took an online course on UX research.", "I want to get good at managing my time.",
        "I'm learning to play the violin.", "I want to improve my chess openings.",
        "Watched a tutorial on color grading videos.", "I'd love to learn how to dance bhangra properly.",
        "I want to build my skills in public relations.", "Working on my patience with the kids.",
        "I want to learn to swim properly this summer.", "I'm getting better at estimating project timelines.",
    ],
    "goal": [
        "My goal is to own a home before I'm thirty five.", "Someday I want to sail around the world.",
        "In ten years I'd like to run my own consulting firm.", "One day I want to publish a poetry collection.",
        "My dream is to become an airline captain.", "Eventually I hope to move to New Zealand.",
        "I aspire to become a VP of engineering.", "Long term I want to be completely debt free.",
        "I'd love to one day build a library in my village.", "Within five years I want to be a principal engineer.",
        "My big dream is to see the northern lights.", "Over the next decade I want to build real wealth.",
        "Before I turn fifty I want to visit fifty countries.", "I want to eventually retire in Himachal.",
        "I want to spend more evenings with my parents.", "My goal for the future is to have a healthy, happy family.",
        "In a few years I'd love to launch a startup.", "I want to get my body fat under 15 percent.",
    ],
    "none": [
        "Today felt really long and heavy.", "I had a nice chat with my neighbour.", "The pizza we ordered was cold.",
        "I'm grateful the kids are healthy.", "Work was chaotic but we got through it.", "I couldn't sleep last night.",
        "We went to the beach and it was lovely.", "I felt a bit sad this evening.", "My brother visited us today.",
        "The presentation went well.", "It snowed for the first time this year.", "I'm in a good mood.",
        "Spent the day at home relaxing.", "The new cafe downtown is cozy.", "I was annoyed at the meeting running late.",
        "Had a great workout this morning.", "Dad told funny stories at dinner.", "The train was packed.",
        "Already paid the water bill this morning.", "My cousin wants to start a bakery.",
    ],
}


def main():
    train = []
    train += build("task", task_sentence, TASK_EXTRA, PER_CLASS)
    train += build("shopping", shopping_sentence, [], PER_CLASS)
    train += build("skill", skill_sentence, SKILL_EXTRA, PER_CLASS)
    train += build("goal", goal_sentence, GOAL_EXTRA, PER_CLASS)
    train += build("none", none_sentence, NONE_SENTENCES + THIRD_PERSON, PER_CLASS)

    eval_rows = [{"text": t, "label": label} for label, rows in EVAL.items() for t in rows]
    norm = lambda s: s.lower().strip(" .!?")
    overlap = {norm(r["text"]) for r in train} & {norm(r["text"]) for r in eval_rows}
    assert not overlap, overlap

    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "seed_training.json").write_text(json.dumps(train, indent=0, ensure_ascii=False) + "\n")
    (OUT / "seed_evaluation.json").write_text(json.dumps(eval_rows, indent=1, ensure_ascii=False) + "\n")
    counts = {}
    for r in train:
        counts[r["label"]] = counts.get(r["label"], 0) + 1
    print(f"train={len(train)} {counts} eval={len(eval_rows)}")


if __name__ == "__main__":
    main()
