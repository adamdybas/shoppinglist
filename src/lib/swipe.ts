export interface SwipeStart {
	x: number;
	y: number;
}

export interface SwipePoint {
	x: number;
	y: number;
}

export function getSwipeProgress(start: SwipeStart, current: SwipePoint, elementWidth: number) {
	const deltaX = current.x - start.x;
	const deltaY = current.y - start.y;

	if (Math.abs(deltaY) > Math.abs(deltaX)) {
		return { cancelled: true, progress: 0 };
	}

	const swipePercentage = Math.max(0, (deltaX / elementWidth) * 100);

	return {
		cancelled: false,
		progress: Math.min(swipePercentage, 100),
		thresholdReached: swipePercentage >= 20
	};
}
