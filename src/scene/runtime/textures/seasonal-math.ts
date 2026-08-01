export interface SeasonalDateStop {
    month: number;
    day: number;
}

export interface CyclicInterpolation<TStop extends SeasonalDateStop> {
    left: TStop;
    right: TStop;
    t: number;
}

export const isLeapYear = (year: number): boolean =>
    year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

export const toDayOfYear = (
    year: number,
    month: number,
    day: number,
): number => {
    const monthOffsets = [
        0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334,
    ];
    const leapOffset = isLeapYear(year) && month > 2 ? 1 : 0;
    return monthOffsets[month - 1] + day + leapOffset;
};

export const getCyclicInterpolation = <TStop extends SeasonalDateStop>(
    isoDate: string,
    stops: ReadonlyArray<TStop>,
): CyclicInterpolation<TStop> => {
    if (stops.length === 0) {
        throw new Error('Seasonal interpolation requires at least one stop.');
    }
    const [yearText, monthText, dayText] = isoDate.split('-');
    const year = Number(yearText);
    const dayOfYear = toDayOfYear(year, Number(monthText), Number(dayText));
    const daysInYear = isLeapYear(year) ? 366 : 365;
    const yearlyStops = stops
        .map((stop) => ({
            day: toDayOfYear(year, stop.month, stop.day),
            stop,
        }))
        .sort((left, right) => left.day - right.day);
    const first = yearlyStops[0];
    const last = yearlyStops[yearlyStops.length - 1];
    const extendedStops = [
        { day: last.day - daysInYear, stop: last.stop },
        ...yearlyStops,
        { day: first.day + daysInYear, stop: first.stop },
    ];

    let left = extendedStops[0];
    let right = extendedStops[1];
    for (let index = 0; index < extendedStops.length - 1; index += 1) {
        const candidateLeft = extendedStops[index];
        const candidateRight = extendedStops[index + 1];
        if (dayOfYear >= candidateLeft.day && dayOfYear < candidateRight.day) {
            left = candidateLeft;
            right = candidateRight;
            break;
        }
    }

    const range = Math.max(1, right.day - left.day);
    return {
        left: left.stop,
        right: right.stop,
        t: Math.max(0, Math.min(1, (dayOfYear - left.day) / range)),
    };
};
