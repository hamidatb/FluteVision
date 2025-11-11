// represents a musical piece as a sequence of notes with timing
// this is like sheet music but in a format our game can understand
export class MusicalTest {
    constructor(name, description, notes, metadata = {}) {
        this.name = name;
        this.description = description;
        this.notes = notes; // array of {gesture, time, duration}
        this.metadata = metadata; 
        
        this._validateNotes();
    }
    
    _validateNotes() {
        this.notes.sort((a, b) => a.time - b.time);
        
        // validate each note has required fields
        this.notes.forEach((note, idx) => {
            if (!note.gesture || typeof note.time !== 'number') {
                throw new Error(`Invalid note at index ${idx}`);
            }
            // default duration if not specified
            if (!note.duration) note.duration = 1000;
        });
    }
    
    getNoteAtTime(currentTime) {
        // find which note(s) should be active at current game time
        return this.notes.filter(note => 
            currentTime >= note.time && 
            currentTime < note.time + note.duration
        );
    }
    
    getNextNote(currentTime) {
        // for showing upcoming notes to the player
        return this.notes.find(note => note.time > currentTime);
    }
    
    getTotalDuration() {
        if (this.notes.length === 0) return 0;
        const lastNote = this.notes[this.notes.length - 1];
        return lastNote.time + lastNote.duration;
    }
    
    // factory method for creating from simplified format
    static fromSimpleFormat(name, description, noteString, tempo = 120) {
        // example: "C:0 D:1 E:2 D:3" means C at beat 0, D at beat 1, etc
        // tempo converts beats to milliseconds
        const beatDuration = (60 / tempo) * 1000;
        
        const notes = noteString.split(' ').map(item => {
            const [gesture, beat] = item.split(':');
            return {
                gesture: gesture.trim(),
                time: parseFloat(beat) * beatDuration,
                duration: beatDuration
            };
        });
        
        return new MusicalTest(name, description, notes, { tempo });
    }
}

export class TestLibrary {
    constructor() {
        this.tests = new Map();
        this._loadDefaultTests();
    }
    
    _loadDefaultTests() {
        // default beginner test using common notes - Bb C D bc those are usually the first notes learned
        this.addTest(MusicalTest.fromSimpleFormat(
            'Beginner Pattern (Bb-C-D)',
            'Basic three-note pattern',
            'Bb:2 C:3 D:4 Bb:5 C:6 D:7 Bb:8 C:9 D:10',
            45 
        ));
        
        this.addTest(MusicalTest.fromSimpleFormat(
            'C Major Scale',
            'Basic scale exercise',
            'C:2 D:3 E:4 F:5 G:6 A:7 Bb:8',
            45 
        ));
        
        this.addTest(MusicalTest.fromSimpleFormat(
            'Simple Arpeggio',
            'Jump between notes',
            'C:2 E:3 G:4 C:5 G:6 E:7 C:8',
            45 
        ));
        
        this.addTest(MusicalTest.fromSimpleFormat(
            'Hot Cross Buns',
            'Traditional melody',
            'D:3 C:5 Bb:7 D:10 C:12 Bb:14 Bb:16 Bb:17 Bb:18 Bb:19 C:20 C:21 C:22 C:23 D:25 C:27 Bb:29',
            40 
        ));
        
        // mary had a little lamb 
        this.addTest(new MusicalTest(
            'Mary Had a Little Lamb',
            'Classic melody for practice',
            [
                {gesture: 'E', time: 2400, duration: 1200},    // start at beat 2
                {gesture: 'D', time: 3600, duration: 1200},
                {gesture: 'C', time: 4800, duration: 1200},
                {gesture: 'D', time: 6000, duration: 1200},
                {gesture: 'E', time: 7200, duration: 1200},
                {gesture: 'E', time: 8400, duration: 1200},
                {gesture: 'E', time: 9600, duration: 2400},    // held note
                {gesture: 'D', time: 12000, duration: 1200},
                {gesture: 'D', time: 13200, duration: 1200},
                {gesture: 'D', time: 14400, duration: 2400},   // held note
                {gesture: 'E', time: 16800, duration: 1200},
                {gesture: 'G', time: 18000, duration: 1200},
                {gesture: 'G', time: 19200, duration: 2400}    // held note
            ],
            {difficulty: 'beginner', composer: 'Traditional'}
        ));
    }
    
    addTest(test) {
        this.tests.set(test.name, test);
    }
    
    getTest(name) {
        return this.tests.get(name);
    }
    
    getAllTests() {
        return Array.from(this.tests.values());
    }
    
    getTestNames() {
        return Array.from(this.tests.keys());
    }
}

// singleton instance
export const testLibrary = new TestLibrary();
