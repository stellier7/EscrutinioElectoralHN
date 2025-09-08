import { generatePartySlotRanges } from './DiputadosEscrutinio';

describe('generatePartySlotRanges', () => {
  test('generates correct slot ranges for Atlántida example (S=8, 5 parties)', () => {
    const seatCount = 8; // S = 8 (Atlántida)
    const partyCount = 5; // 5 parties
    
    const ranges = generatePartySlotRanges(seatCount, partyCount);
    
    // Verify we get 5 ranges (one per party)
    expect(ranges).toHaveLength(5);
    
    // Verify Party 0: 1–8
    expect(ranges[0]).toEqual({
      start: 1,
      end: 8,
      range: '1–8',
      casillas: [1, 2, 3, 4, 5, 6, 7, 8]
    });
    
    // Verify Party 1: 9–16
    expect(ranges[1]).toEqual({
      start: 9,
      end: 16,
      range: '9–16',
      casillas: [9, 10, 11, 12, 13, 14, 15, 16]
    });
    
    // Verify Party 2: 17–24
    expect(ranges[2]).toEqual({
      start: 17,
      end: 24,
      range: '17–24',
      casillas: [17, 18, 19, 20, 21, 22, 23, 24]
    });
    
    // Verify Party 3: 25–32
    expect(ranges[3]).toEqual({
      start: 25,
      end: 32,
      range: '25–32',
      casillas: [25, 26, 27, 28, 29, 30, 31, 32]
    });
    
    // Verify Party 4: 33–40
    expect(ranges[4]).toEqual({
      start: 33,
      end: 40,
      range: '33–40',
      casillas: [33, 34, 35, 36, 37, 38, 39, 40]
    });
  });

  test('generates correct slot ranges for different department sizes', () => {
    // Test smaller department (S=3, 4 parties)
    const smallRanges = generatePartySlotRanges(3, 4);
    expect(smallRanges).toHaveLength(4);
    expect(smallRanges[0].range).toBe('1–3');
    expect(smallRanges[1].range).toBe('4–6');
    expect(smallRanges[2].range).toBe('7–9');
    expect(smallRanges[3].range).toBe('10–12');
    
    // Test larger department (S=12, 3 parties)
    const largeRanges = generatePartySlotRanges(12, 3);
    expect(largeRanges).toHaveLength(3);
    expect(largeRanges[0].range).toBe('1–12');
    expect(largeRanges[1].range).toBe('13–24');
    expect(largeRanges[2].range).toBe('25–36');
  });

  test('verifies algorithm implementation: start = i * S + 1, end = (i + 1) * S', () => {
    const S = 8; // seatCount
    const partyCount = 5;
    
    const ranges = generatePartySlotRanges(S, partyCount);
    
    for (let i = 0; i < partyCount; i++) {
      const expectedStart = i * S + 1;
      const expectedEnd = (i + 1) * S;
      
      expect(ranges[i].start).toBe(expectedStart);
      expect(ranges[i].end).toBe(expectedEnd);
      expect(ranges[i].casillas).toHaveLength(S);
      expect(ranges[i].casillas[0]).toBe(expectedStart);
      expect(ranges[i].casillas[S - 1]).toBe(expectedEnd);
    }
  });

  test('ensures no gaps or overlaps between party ranges', () => {
    const ranges = generatePartySlotRanges(8, 5);
    
    for (let i = 0; i < ranges.length - 1; i++) {
      const currentEnd = ranges[i].end;
      const nextStart = ranges[i + 1].start;
      
      // Next party should start immediately after current party ends
      expect(nextStart).toBe(currentEnd + 1);
    }
  });
});
