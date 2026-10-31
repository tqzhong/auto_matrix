"""Carry contact corrections through motion, then recover the authored rest."""


def envelope(time):
    amount = min(1., max(0., (time - 3.2) / (8. - 3.2)))
    return 1. - amount**3 * (amount * (amount * 6. - 15.) + 10.)


def transport_target(before, raw_before, raw_after, begin_time, end_time, anchors):
    remaining = envelope(begin_time)
    ratio = envelope(end_time) / remaining if remaining else 0.
    target = raw_after + (before - raw_before) * ratio
    target[anchors] = raw_after[anchors]
    return target
