// represents a musical piece as a sequence of notes with timing
// this is like sheet music but in a format our game can understand
class MusicalTest {
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

