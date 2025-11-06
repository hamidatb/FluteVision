// represents a musical piece as a sequence of notes with timing
// this is like sheet music but in a format our game can understand
export class MusicalTest {
    constructor(name, description, notes, metadata = {}) {
        this.name = name;
        this.description = description;
        this.notes = notes; // array of {gesture, time, duration}
        this.metadata = metadata; // composer, difficulty, etc
        
        this._validateNotes();
    }
    
    _validateNotes() {
        // ensure notes are sorted by time bc the game needs them in order
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
            'Bb:0 C:1 D:2 Bb:3 C:4 D:5 Bb:6 C:7 D:8',
            100 // slower tempo for beginners
        ));
        
        // simple scale - good for general practice
        this.addTest(MusicalTest.fromSimpleFormat(
            'C Major Scale',
            'Basic scale exercise',
            'C:0 D:1 E:2 F:3 G:4 A:5 Bb:6',
            120
        ));
        
        // arpeggio pattern
        this.addTest(MusicalTest.fromSimpleFormat(
            'Simple Arpeggio',
            'Jump between notes',
            'C:0 E:1 G:2 C:3 G:4 E:5 C:6',
            140
        ));
        
        // hot cross buns - classic beginner song
        this.addTest(MusicalTest.fromSimpleFormat(
            'Hot Cross Buns',
            'Traditional melody',
            'E:0 D:1 C:2 E:4 D:5 C:6 C:8 C:8.5 C:9 C:9.5 D:10 D:10.5 D:11 D:11.5 E:12 D:13 C:14',
            100
        ));
        
        // mary had a little lamb
        this.addTest(new MusicalTest(
            'Mary Had a Little Lamb',
            'Classic melody for practice',
            [
                {gesture: 'E', time: 0, duration: 500},
                {gesture: 'D', time: 500, duration: 500},
                {gesture: 'C', time: 1000, duration: 500},
                {gesture: 'D', time: 1500, duration: 500},
                {gesture: 'E', time: 2000, duration: 500},
                {gesture: 'E', time: 2500, duration: 500},
                {gesture: 'E', time: 3000, duration: 1000},
                {gesture: 'D', time: 4000, duration: 500},
                {gesture: 'D', time: 4500, duration: 500},
                {gesture: 'D', time: 5000, duration: 1000},
                {gesture: 'E', time: 6000, duration: 500},
                {gesture: 'G', time: 6500, duration: 500},
                {gesture: 'G', time: 7000, duration: 1000}
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
    
    // future: load from MIDI files
    async loadFromMidi(midiFile) {
        // TODO: parse MIDI and convert to MusicalTest
        // using web-midi-api or tonejs/midi library
        throw new Error('MIDI loading not yet implemented');
    }
    
    // future: load from JSON file
    async loadFromJson(jsonData) {
        const data = typeof jsonData === 'string' ? JSON.parse(jsonData) : jsonData;
        const test = new MusicalTest(
            data.name,
            data.description,
            data.notes,
            data.metadata
        );
        this.addTest(test);
        return test;
    }
}

// singleton instance
export const testLibrary = new TestLibrary();
