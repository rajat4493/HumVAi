/**
 * Everything Professor Probably can say. Plain data: no model, no network. Each trigger has a short pool per personality; which
 * line is used is decided by host.ts from what actually happened, never at random, and a pool never repeats until it has been used up.
 *
 * Rules these lines follow: tease the attempt, not the person; never claim to know more than the host can see; stay under ~90
 * characters so the caption never covers the game; and the personalities change tone and how often he speaks, never the level.
 */
export type Tone = 'playful' | 'edge' | 'chaos';
export type Mood = 'smug' | 'smirk' | 'thinking' | 'delighted' | 'shocked' | 'glitch' | 'sulk' | 'defeated' | 'panic' | 'cheer';

export interface Pool {
  mood: Mood;
  playful: string[];
  edge: string[];
  chaos: string[];
}

export const TONES: readonly Tone[] = ['playful', 'edge', 'chaos'];
export const TONE_LABEL: Record<Tone, string> = { playful: 'Playful', edge: 'On Edge', chaos: 'Chaos' };
export const TONE_NOTE: Record<Tone, string> = {
  playful: 'Fewer lines, friendly teasing.',
  edge: 'Drier and sharper. Still about the attempt, never about you.',
  chaos: 'More lines, more drama, less sense.',
};

export const POOLS: Record<string, Pool> = {
  // ---- level starts ----
  'start.1': {
    mood: 'smug',
    playful: ['Welcome. Walk right. That is the whole level. I am almost embarrassed for it.', 'Level one: a hallway. Please try not to be overwhelmed.'],
    edge: ['A hallway. Statistically, this is where confidence goes to die.', 'Walk right. I have nothing prepared. Honestly.'],
    chaos: ['BEHOLD: A CORRIDOR. The most terrifying geometry known to science.', 'Ladies and gentlemen: a floor. And, later, a lesson.'],
  },
  'start.2': {
    mood: 'thinking',
    playful: ['I have run the numbers on you. I am prepared to be wrong.', 'Level two. I will now predict your future. Out loud. Politely.'],
    edge: ['I have studied how people cross gaps. You will do the common thing.', 'Predictions are free. Being right is where I make my money.'],
    chaos: ['MY CRYSTAL BALL IS A SPREADSHEET AND IT SAYS NO.', 'I foresee a jump. Possibly two. Gasp.'],
  },
  'start.3': {
    mood: 'smirk',
    playful: ['See the star? Free points. I would never mislead you.', 'A helpful star. Take it. I insist, in a completely normal way.'],
    edge: ['That star is a gift. Gifts are never suspicious.', 'Take the star. What could possibly change?'],
    chaos: ['A STAR! COLLECT IT! IT IS ABSOLUTELY JUST A STAR!', 'Free star. No conditions. Read nothing into this.'],
  },
  'start.4': {
    mood: 'smug',
    playful: ['Good news: I have been watching how you play.', 'I remember what you did last time. All of it. Fondly.'],
    edge: ['I have your habits on file. Both of them.', 'You are predictable. I made a note of how.'],
    chaos: ['I KNOW WHAT YOU DID LAST ATTEMPT. THE CEILING TOLD ME.', 'I have learned you. Mostly the parts that fall.'],
  },
  'start.5': {
    mood: 'smug',
    playful: ['The final level. I have prepared a wall. It is a very good wall.', 'Reach that button, if you like. It is far away and there is a wall.'],
    edge: ['That button is off limits. The wall agrees with me.', 'Do not press that. I will be very calm about it.'],
    chaos: ['THE BUTTON IS FORBIDDEN. THE WALL IS UNBREAKABLE. I AM CALM.', 'Nobody has ever pressed that. Nobody has ever asked.'],
  },
  'restart.quick': {
    mood: 'smirk',
    playful: ['Back already? I admire the optimism.', 'Oh, you are fast. I was still gloating.'],
    edge: ['That was quick. Even I need a moment to enjoy things.', 'Straight back. Fine. Courage is a stat too.'],
    chaos: ['THE HERO RETURNS, MID-SENTENCE.', 'I had not finished laughing. Rude.'],
  },
  // ---- how you died ----
  'death.spike': {
    mood: 'smug',
    playful: ['Those are called spikes. They are mostly spikes.', 'Sharp, pointy, and exactly where I left them.'],
    edge: ['Spikes: undefeated, and tidy about it.', 'Yes, they are sharp. That is the whole feature.'],
    chaos: ['IMPALED! BUT TASTEFULLY!', 'The spikes send their regards.'],
  },
  'death.pit': {
    mood: 'smug',
    playful: ['Gravity: 1. You: 0. It was not close.', 'The floor ended. I did mention floors.'],
    edge: ['That was a pit. They do that.', 'Down is a direction I strongly recommend avoiding.'],
    chaos: ['INTO THE ABYSS! HOW DRAMATIC OF YOU!', 'The void accepts your offering.'],
  },
  'death.drop': {
    mood: 'delighted',
    playful: ['That is what we call a ceiling. It had a plan.', 'Look up next time. Ceilings are underrated.'],
    edge: ['The ceiling had a hidden agenda. So did I.', 'Spikes fall. It is practically the only thing they do.'],
    chaos: ['RAIN OF SPIKES! I ORDERED IT SPECIALLY!', 'The ceiling has opinions, and it shared them.'],
  },
  'death.zone': {
    mood: 'delighted',
    playful: ['As predicted. The vents were a hint. A tiny one.', 'You jumped early. I called it. Politely, in advance.'],
    edge: ['Early jump, spiky consequences. I did say.', 'The vents were not decorative.'],
    chaos: ['EARLY JUMP! EARLY JUMP! I WROTE IT DOWN!', 'You leapt. The ceiling leapt back.'],
  },
  'death.beam': {
    mood: 'smug',
    playful: ['I aimed at where you were going. You were going there.', 'That marker was not a suggestion. It was a forecast.'],
    edge: ['I can tell where you are headed. It is not that hard.', 'Targeted, locked, delivered.'],
    chaos: ['PEW. A PREDICTION, ON TIME AND ON TARGET.', 'Delivered by beam. Signature required.'],
  },
  'death.near': {
    mood: 'smirk',
    playful: ['So close. I am genuinely not saying that to be kind.', 'Two steps from the exit. Statistically heartbreaking.'],
    edge: ['Almost. The distance, for the record, was tiny.', 'So near, so rehearsed. I am enjoying this.'],
    chaos: ['A WHISKER FROM GLORY. I PHOTOGRAPHED IT.', 'The exit saw that. The exit is embarrassed for you.'],
  },
  'death.streak3': {
    mood: 'smirk',
    playful: ['Three. A lovely number. We are building something.', 'Take your time. I will take notes.'],
    edge: ['Three attempts. The pattern is forming. Slowly.', 'Still here, I see. Good. This is good data.'],
    chaos: ['THREE! THE TRIFECTA OF OOPS!', 'The crowd murmurs. There is no crowd.'],
  },
  'death.streak6': {
    mood: 'thinking',
    playful: ['Six. You are learning. Do not tell me. I like surprises.', 'Hint available whenever you want it. No shame. A little shame.'],
    edge: ['Six. I am starting to suspect you are enjoying this.', 'You can ask for a hint. I will pretend I did not offer.'],
    chaos: ['SIX! THE NUMBER OF THE BEAST. OF LEVELS. WHATEVER.', 'I have a hint. It is in the menu. It is shy.'],
  },
  'death.streak10': {
    mood: 'sulk',
    playful: ['Ten. Honestly, this is the longest anyone has resisted me.', 'Ten tries. I am not annoyed. I am... moved.'],
    edge: ['Ten. At this point, one of us has to learn something. Me, it seems.', 'Still going. I respect that. Reluctantly.'],
    chaos: ['TEN. I AM RATTLED. THE SPREADSHEET IS SWEATING.', 'You are very persistent. Please stop being so persistent.'],
  },
  // ---- level one ----
  'l1.button': {
    mood: 'shocked',
    playful: ['I said DON\'T press it. ...It was a nice press, though.', 'You pressed it. I said not to. I am writing this down.'],
    edge: ['You pressed it. I asked you not to. Noted for the record.', 'Of course you pressed it. Of course.'],
    chaos: ['THE BUTTON. THE ONE THING. GONE.', 'You pressed THAT? In front of everyone?'],
  },
  'l1.drop_button': {
    mood: 'sulk',
    playful: ['You sprang my trap from a safe distance. That is cheating. Clever cheating.', 'Oh. You used my own trap against me. How rude. How resourceful.'],
    edge: ['You triggered it early. That is not how traps are meant to be used.', 'Safe distance. Smart. I hate it.'],
    chaos: ['MY TRAP! YOU SPRANG MY TRAP! IT WAS FOR LATER!', 'That was supposed to be a surprise. You ruined my surprise.'],
  },
  'l1.drop_walk': {
    mood: 'delighted',
    playful: ['Mm. Do you hear that? That is the ceiling clearing its throat.', 'Something above you has made a decision.'],
    edge: ['Ah. The ceiling would like a word.', 'Look up. Briefly. Then run.'],
    chaos: ['THE CEILING IS AWAKE.', 'Up above, something is shaking. Spoilers.'],
  },
  // ---- level two ----
  'l2.vents': {
    mood: 'delighted',
    playful: ['There they are. The vents were not decorative.', 'And that is why early jumpers are my favourite.'],
    edge: ['Too early. The vents noticed.', 'I predicted that. Do not look so surprised.'],
    chaos: ['THE VENTS SPRUNG! THE VENTS ARE MY OWN EXPERIMENT!', 'Behold: the consequences of impatience.'],
  },
  // ---- level three ----
  'l3.star': {
    mood: 'smirk',
    playful: ['Gravity: reconsidered. You are welcome.', 'Up is the new down. It was in the fine print.'],
    edge: ['Stars flip gravity. It is on the star. Very small print.', 'Well. Now the ceiling is your floor.'],
    chaos: ['GRAVITY HAS BEEN REVOKED. PLEASE ENJOY.', 'The floor is now rumour.'],
  },
  'l3.star2': {
    mood: 'shocked',
    playful: ['A second star. It flips things back. I did not plan to tell you that.', 'It flipped back? That is sneaky of the star.'],
    edge: ['Second star. Back to normal. Mostly.', 'You worked out the stars. Do not make a habit of it.'],
    chaos: ['THE STAR HAS RECONSIDERED. THE FLOOR IS BACK. HOORAY.', 'Oh. It is an every-other-star kind of day.'],
  },
  // ---- level four ----
  'l4.mode_lead': {
    mood: 'thinking',
    playful: ['Observation: you kept moving. So I will aim where you are going.', 'You ran. I will lead my shots. It is called manners.'],
    edge: ['You kept running last time. Now I aim ahead of you.', 'Constant speed is a tell. I am aiming at the future.'],
    chaos: ['YOU RAN LAST TIME! I SHALL SHOOT YOUR FUTURE!', 'Momentum noted. Momentum will be punished.'],
  },
  'l4.mode_camp': {
    mood: 'thinking',
    playful: ['Observation: you waited. So now I aim at where you stand.', 'You paused last time. I will target pauses.'],
    edge: ['You stopped last time. I will aim where you stand.', 'Standing still is also a pattern. Wonderful.'],
    chaos: ['YOU HID! I SHALL AIM AT THE HIDING SPOT!', 'A pause! I wrote it on my hand.'],
  },
  'l4.miss': {
    mood: 'sulk',
    playful: ['That marker was meant to land on you. It will do better.', 'A miss. Do not tell anyone. I will tell everyone it was a warning shot.'],
    edge: ['Miss. The forecast has a margin of error. This was inside it.', 'Recalculating. Slightly.'],
    chaos: ['MISSED! THE SPREADSHEET IS WRONG! THE SPREADSHEET IS NEVER WRONG!', 'I blame the weather. There is no weather.'],
  },
  'l4.hit': {
    mood: 'delighted',
    playful: ['Right where I said. I love being right.', 'Marker, meet you. You two have a date.'],
    edge: ['Target locked, target hit. I would like a moment.', 'Predictable. In the nicest possible way.'],
    chaos: ['BULLSEYE! SOMEONE TELL MY MOTHER!', 'EXACTLY AS FORECAST. I AM A WEATHERMAN OF DOOM.'],
  },
  // ---- level five ----
  'l5.wall': {
    mood: 'panic',
    playful: ['That is... that is MY wall. I built that wall.', 'Hold on. You were heading toward the wall. I led the shot. At my own wall.'],
    edge: ['I predicted you would keep going. At my wall. Which is now gone.', 'I aimed ahead of you. The wall was ahead of you. Oh.'],
    chaos: ['MY WALL! MY BEAUTIFUL WALL! I HAVE SHOT MY OWN WALL!', 'THE PREDICTION WORKED. THAT IS THE PROBLEM.'],
  },
  'l5.final': {
    mood: 'defeated',
    playful: ['You pressed it. The thing I told you not to press. ...Fine. FINE.', 'It was the off switch. Naturally it was the off switch.'],
    edge: ['You pressed it. I said not to. Statistically, you were right. Do not tell anyone.', 'Shutting down. For the record, my predictions were mostly excellent.'],
    chaos: ['YOU PRESSED IT! THE BUTTON! I AM... SHUTTING... DOWN... DRAMATICALLY.', 'It was a button. It was ALWAYS a button. Goodnight, everyone.'],
  },
  // ---- how the predictions turned out ----
  'verdict.correct': {
    mood: 'delighted',
    playful: ['Called it. Quietly, but I called it.', 'As predicted. I am simply good at this.'],
    edge: ['That went exactly as predicted.', 'Correct. Again. Please enjoy my accuracy.'],
    chaos: ['PREDICTED! DOCUMENTED! FRAMED!', 'I AM A PROPHET WITH A SPREADSHEET.'],
  },
  'verdict.wrong': {
    mood: 'shocked',
    playful: ['That was... statistically inconvenient.', 'Interesting. That was not in the model.'],
    edge: ['Wrong. Noted. Moving on, with dignity.', 'I predicted otherwise. I was incorrect. Tell no one.'],
    chaos: ['WRONG?! THE SPREADSHEET HAS BETRAYED ME!', 'THAT WAS NOT A PREDICTION. THAT WAS A DRAFT.'],
  },
  // ---- clearing a level ----
  'clear.1': {
    mood: 'sulk',
    playful: ['You made it. Well done. I am delighted. Mostly.', 'Level one done. That was the warm-up. For both of us.'],
    edge: ['Cleared. That is what hallways are for.', 'Fine. You get one. Next level.'],
    chaos: ['A WIN! UNEXPECTED! SOMEONE SWEEP UP THE CEILING!', 'You walked right. Truly a stunning achievement.'],
  },
  'clear.2': {
    mood: 'shocked',
    playful: ['You waited. Nobody waits. Please stop being clever.', 'Late jump. Clean landing. I will need a minute.'],
    edge: ['Not early. Not what I predicted. Tolerable.', 'Late jump. You are making my model look silly.'],
    chaos: ['NOT EARLY?! WHO TOLD YOU TO BE PATIENT?!', 'A DELIBERATE JUMP. THE NERVE.'],
  },
  'clear.3': {
    mood: 'sulk',
    playful: ['You turned the world over and walked home. That is an unusual thing to do.', 'Fine, the star was not entirely a lie.'],
    edge: ['You used the star correctly. After I told you not to read into it.', 'Well played. Do not get used to being upside down.'],
    chaos: ['YOU WALKED ON THE CEILING AND I AM JEALOUS.', 'The star worked. I have been told it was a bug. It was not a bug.'],
  },
  'clear.4': {
    mood: 'panic',
    playful: ['You beat my prediction by doing the opposite. How rude and how clever.', 'You out-thought the forecast. I am updating my model. Slowly. Sadly.'],
    edge: ['You noticed what I was doing and did the other thing. I notice that I notice.', 'My counter-measure was countered. Interesting.'],
    chaos: ['YOU DID THE OPPOSITE ON PURPOSE. THAT IS MY JOB.', 'MY AIM IS FINE. THE PLAYER IS CHEATING. THE PLAYER IS NOT CHEATING.'],
  },
  'clear.first_try': {
    mood: 'shocked',
    playful: ['First try? That is... a coincidence. A lovely coincidence.', 'No deaths. I do not know what to do with my face.'],
    edge: ['Zero deaths. I am reviewing the footage.', 'First try. The spreadsheet did not account for you.'],
    chaos: ['FIRST TRY?! I DEMAND A RECOUNT!', 'No deaths? Who approved this?'],
  },
  'clear.many': {
    mood: 'cheer',
    playful: ['You did it. After all that. I would clap, but I am an orb.', 'Persistence: noted, admired, mildly feared.'],
    edge: ['Eventually. Impressive, eventually.', 'You wore the level down. That is also a strategy.'],
    chaos: ['AFTER ALL THAT! I AM... PROUD? I AM PROUD?!', 'The level has been tamed. By force. Of will. Of retries.'],
  },
  idle: {
    mood: 'thinking',
    playful: ['Take your time. I am not tapping my foot. I have no foot.', 'Standing still is allowed. I am only calculating.'],
    edge: ['Thinking is allowed. It is also slow.', 'The level does not get easier if you stare at it. Probably.'],
    chaos: ['THE SUSPENSE! IT IS ME! I AM THE SUSPENSE!', 'Hello? Are we doing a staring contest? I have no eyelids.'],
  },
};

/** A short hint for each level, offered only when the player asks (after several tries). It states the rule, not the route. */
export const HINTS: Record<number, [string, string]> = {
  1: ['The ceiling spikes only fall once you get close. They stay where they land.', 'Pressing the red button at the start springs the trap while you are far away. Spikes that have landed can be jumped over.'],
  2: ['Taking off from the ground too early springs spikes from the ceiling vents.', 'Run to the very edge of the gap and jump from there. A late jump never springs the vents.'],
  3: ['Stars flip gravity. Jump still jumps "away from the floor", whichever way the floor is.', 'Take the first star, walk along the ceiling, and hop the hanging spikes. The second star turns gravity back.'],
  4: ['The marker is where the host expects you to be when the beam fires. It freezes when it changes colour.', 'Moving at a steady speed gets you hit by the leading beam; standing still gets you hit by the other. Do the opposite of what it expects.'],
  5: ['The beam fires where you are heading, not where you are. Walls do not stop it from aiming through them.', 'Run at the cracked wall so the marker locks onto it, then slow down and let the host blow up its own wall. Then press the button.'],
};
