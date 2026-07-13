import { describe, expect, it } from 'vitest';
import { parseItems } from './parseItems';

describe('parseItems', () => {
	it('parses a clean JSON array', () => {
		expect(parseItems('["milk", "2x eggs", "bread"]')).toEqual(['milk', '2x eggs', 'bread']);
	});

	it('finds the array inside surrounding prose', () => {
		const text = 'Here are the items I can read:\n["milk", "eggs"]\nLet me know if you need more!';
		expect(parseItems(text)).toEqual(['milk', 'eggs']);
	});

	it('finds the array inside a markdown code fence', () => {
		expect(parseItems('```json\n["milk", "eggs"]\n```')).toEqual(['milk', 'eggs']);
	});

	it('returns [] for almost-JSON that does not parse', () => {
		// Single quotes are valid JS but not valid JSON — a classic model slip.
		expect(parseItems("['milk', 'eggs']")).toEqual([]);
	});

	it('returns [] when the response has no array at all', () => {
		expect(parseItems('I could not read any items in this photo.')).toEqual([]);
	});

	it('returns [] when the model answers with an object instead of an array', () => {
		expect(parseItems('{"items": "milk"}')).toEqual([]);
	});

	it('keeps only string entries', () => {
		expect(parseItems('[1, "milk", null, true, "eggs"]')).toEqual(['milk', 'eggs']);
	});

	it('trims entries and drops empty ones', () => {
		expect(parseItems('["  milk  ", "", "   "]')).toEqual(['milk']);
	});

	it('handles an empty array (nothing legible on the photo)', () => {
		expect(parseItems('[]')).toEqual([]);
	});
});
