from datetime import date

from crm.domain import services


def test_date_range_from_pg_adjusts_exclusive_upper_bound() -> None:
    pg_range = services.PgRange(
        lower=date(2024, 1, 1),
        upper=date(2024, 1, 11),
        lower_inc=True,
        upper_inc=False,
    )

    result = services.CalculationService._date_range_from_pg(pg_range)

    assert result is not None
    assert result.start == date(2024, 1, 1)
    assert result.end == date(2024, 1, 10)


def test_date_range_from_pg_keeps_inclusive_upper_bound() -> None:
    pg_range = services.PgRange(
        lower=date(2024, 1, 1),
        upper=date(2024, 1, 10),
        lower_inc=True,
        upper_inc=True,
    )

    result = services.CalculationService._date_range_from_pg(pg_range)

    assert result is not None
    assert result.start == date(2024, 1, 1)
    assert result.end == date(2024, 1, 10)
