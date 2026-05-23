// Exact-ratio helpers for just intonation lattice labels and axes.
const JI_AXIS_KEYS = ['right', 'upRight', 'downRight'];
const DEFAULT_JI_AXES = {
    right: '3/2',
    upRight: '5/4',
    downRight: '6/5'
};
const DEFAULT_JI_LABEL_DISPLAY = 'monzo';

function gcdBigInt(a, b) {
    let left = a < 0n ? -a : a;
    let right = b < 0n ? -b : b;
    while (right !== 0n) {
        const next = left % right;
        left = right;
        right = next;
    }
    return left || 1n;
}

function reduceJiFraction(fraction) {
    if (!fraction) return null;
    let num = BigInt(fraction.num);
    let den = BigInt(fraction.den);
    if (den === 0n) return null;
    if (den < 0n) {
        num = -num;
        den = -den;
    }
    if (num <= 0n || den <= 0n) return null;
    const divisor = gcdBigInt(num, den);
    return { num: num / divisor, den: den / divisor };
}

function parseJiFraction(value) {
    const raw = String(value ?? '').trim();
    const match = /^(\d+)\/(\d+)$/.exec(raw);
    if (!match) return null;
    const fraction = reduceJiFraction({ num: BigInt(match[1]), den: BigInt(match[2]) });
    if (!fraction) return null;
    if (fraction.num <= fraction.den) return null;
    if (fraction.num >= fraction.den * 2n) return null;
    return fraction;
}

function formatJiFraction(fraction) {
    const reduced = reduceJiFraction(fraction);
    if (!reduced) return DEFAULT_JI_AXES.right;
    return `${reduced.num.toString()}/${reduced.den.toString()}`;
}

function multiplyJiFractions(a, b) {
    return reduceJiFraction({
        num: BigInt(a.num) * BigInt(b.num),
        den: BigInt(a.den) * BigInt(b.den)
    });
}

function divideJiFractions(a, b) {
    return reduceJiFraction({
        num: BigInt(a.num) * BigInt(b.den),
        den: BigInt(a.den) * BigInt(b.num)
    });
}

function normalizeJiFractionToOctave(fraction) {
    const normalized = reduceJiFraction(fraction);
    if (!normalized) return parseJiFraction(DEFAULT_JI_AXES.right);
    let num = normalized.num;
    let den = normalized.den;
    while (num <= den) num *= 2n;
    while (num >= den * 2n) den *= 2n;
    return reduceJiFraction({ num, den });
}

function normalizeJiAxisInput(value, fallback) {
    return parseJiFraction(value) || parseJiFraction(fallback) || parseJiFraction(DEFAULT_JI_AXES.right);
}

function deriveJiAxes(values, derivedAxis) {
    const axes = {
        right: normalizeJiAxisInput(values?.right, DEFAULT_JI_AXES.right),
        upRight: normalizeJiAxisInput(values?.upRight, DEFAULT_JI_AXES.upRight),
        downRight: normalizeJiAxisInput(values?.downRight, DEFAULT_JI_AXES.downRight)
    };

    if (derivedAxis === 'right') {
        axes.right = normalizeJiFractionToOctave(multiplyJiFractions(axes.upRight, axes.downRight));
    } else if (derivedAxis === 'upRight') {
        axes.upRight = normalizeJiFractionToOctave(divideJiFractions(axes.right, axes.downRight));
    } else if (derivedAxis === 'downRight') {
        axes.downRight = normalizeJiFractionToOctave(divideJiFractions(axes.right, axes.upRight));
    }

    return axes;
}

function factorBigInt(value) {
    let remaining = value < 0n ? -value : value;
    const factors = {};
    let prime = 2n;
    while (prime * prime <= remaining) {
        while (remaining % prime === 0n) {
            const key = prime.toString();
            factors[key] = (factors[key] || 0) + 1;
            remaining /= prime;
        }
        prime = prime === 2n ? 3n : prime + 2n;
    }
    if (remaining > 1n) {
        const key = remaining.toString();
        factors[key] = (factors[key] || 0) + 1;
    }
    return factors;
}

function fractionToMonzo(fraction) {
    const reduced = reduceJiFraction(fraction);
    const monzo = {};
    if (!reduced) return monzo;
    const numeratorFactors = factorBigInt(reduced.num);
    const denominatorFactors = factorBigInt(reduced.den);
    for (const prime of Object.keys(numeratorFactors)) {
        monzo[prime] = (monzo[prime] || 0) + numeratorFactors[prime];
    }
    for (const prime of Object.keys(denominatorFactors)) {
        monzo[prime] = (monzo[prime] || 0) - denominatorFactors[prime];
    }
    return monzo;
}

function scaleMonzo(monzo, scalar) {
    const result = {};
    const multiplier = Number(scalar) || 0;
    for (const prime of Object.keys(monzo || {})) {
        const value = monzo[prime] * multiplier;
        if (value) result[prime] = value;
    }
    return result;
}

function addMonzos(...monzos) {
    const result = {};
    for (const monzo of monzos) {
        for (const prime of Object.keys(monzo || {})) {
            result[prime] = (result[prime] || 0) + monzo[prime];
            if (result[prime] === 0) delete result[prime];
        }
    }
    return result;
}

function getMonzoPrimes(...monzos) {
    const primes = new Set(['2', '3', '5']);
    for (const monzo of monzos) {
        for (const prime of Object.keys(monzo || {})) primes.add(prime);
    }
    return Array.from(primes).sort(function (a, b) {
        return Number(a) - Number(b);
    });
}

function powBigInt(base, exponent) {
    let result = 1n;
    for (let i = 0; i < exponent; i++) result *= base;
    return result;
}

function monzoToFraction(monzo) {
    let num = 1n;
    let den = 1n;
    for (const prime of Object.keys(monzo || {})) {
        const exp = monzo[prime];
        if (!exp) continue;
        const power = powBigInt(BigInt(prime), Math.abs(exp));
        if (exp > 0) num *= power;
        else den *= power;
    }
    return reduceJiFraction({ num, den });
}

function formatMonzoVector(monzo, primes) {
    const vector = (primes && primes.length ? primes : getMonzoPrimes(monzo)).map(function (prime) {
        return String(monzo?.[prime] || 0);
    });
    return `[${vector.join(' ')}>`;
}

function monzoToCents(monzo) {
    let cents = 0;
    for (const prime of Object.keys(monzo || {})) {
        cents += (monzo[prime] || 0) * 1200 * Math.log2(Number(prime));
    }
    cents %= 1200;
    if (cents < 0) cents += 1200;
    if (Math.abs(cents - 1200) < 0.000001) cents = 0;
    return cents;
}

function normalizeJiLabelDisplay(value) {
    return ['monzo', 'fraction', 'cents'].includes(value) ? value : DEFAULT_JI_LABEL_DISPLAY;
}

function createJiPitchAdapter(axisValues, labelDisplay) {
    const axes = deriveJiAxes(axisValues, null);
    const rightMonzo = fractionToMonzo(axes.right);
    const downRightMonzo = fractionToMonzo(axes.downRight);
    const primes = getMonzoPrimes(rightMonzo, downRightMonzo, fractionToMonzo(axes.upRight));
    const display = normalizeJiLabelDisplay(labelDisplay);

    return {
        getLabel(q, r) {
            const monzo = addMonzos(scaleMonzo(rightMonzo, q), scaleMonzo(downRightMonzo, r));
            let text;
            if (display === 'fraction') {
                text = formatJiFraction(monzoToFraction(monzo));
            } else if (display === 'cents') {
                text = `${monzoToCents(monzo).toFixed(1)}c`;
            } else {
                text = formatMonzoVector(monzo, primes);
            }
            return {
                text,
                value: monzo,
                isZero: Object.keys(monzo).length === 0,
                scaleKey: null
            };
        }
    };
}
