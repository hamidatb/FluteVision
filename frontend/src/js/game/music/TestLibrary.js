// collection of predefined musical tests
// keeping this separate bc users will eventually load custom tests from files
class TestLibrary {
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
const testLibrary = new TestLibrary();

