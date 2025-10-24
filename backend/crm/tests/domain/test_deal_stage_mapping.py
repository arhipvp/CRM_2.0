from crm.domain.schemas import map_deal_status_to_stage


def test_map_deal_status_handles_camel_case_values() -> None:
    assert map_deal_status_to_stage("closedWon") == "closedWon"
    assert map_deal_status_to_stage("ClosedLost") == "closedLost"


def test_map_deal_status_handles_in_progress_variants() -> None:
    assert map_deal_status_to_stage("inProgress") == "negotiation"
    assert map_deal_status_to_stage("in-progress") == "negotiation"
