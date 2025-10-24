from crm.domain.schemas import map_deal_status_to_stage, map_stage_to_deal_status


def test_map_deal_status_handles_camel_case_values() -> None:
    assert map_deal_status_to_stage("closedWon") == "closedWon"
    assert map_deal_status_to_stage("ClosedLost") == "closedLost"


def test_map_deal_status_handles_in_progress_variants() -> None:
    assert map_deal_status_to_stage("inProgress") == "negotiation"
    assert map_deal_status_to_stage("in-progress") == "negotiation"


def test_map_deal_status_handles_values_with_spaces() -> None:
    assert map_deal_status_to_stage("Closed Won") == "closedWon"
    assert map_deal_status_to_stage("closed lost") == "closedLost"


def test_stage_to_status_maps_qualification_to_canonical_status() -> None:
    assert map_stage_to_deal_status("qualification") == "qualification"


def test_stage_to_status_maps_other_stages() -> None:
    assert map_stage_to_deal_status("negotiation") == "in_progress"
    assert map_stage_to_deal_status("closedWon") == "won"
