from tkinter import ttk
from typing import List, Dict, Any

def treeview_sort_column(tree: ttk.Treeview, col: str, reverse: bool, data_source: List[Dict[str, Any]], display_map: Dict[str, str]):
    """
    Sorts a Treeview column when its header is clicked.
    :param tree: The ttk.Treeview widget.
    :param col: The column identifier to sort by.
    :param reverse: Boolean indicating if the sort order should be reversed.
    :param data_source: The original list of dictionaries containing the data.
    :param display_map: A dictionary mapping column identifiers to the actual keys in data_source.
    """
    l = [(tree.set(k, col), k) for k in tree.get_children('')]

    # Determine the actual key in the data_source to sort by
    sort_key = display_map.get(col, col)

    # Sort the data_source directly
    # For numerical columns, convert to float/int for proper sorting
    def sort_func(item):
        val = item[0]
        try:
            return float(val)
        except ValueError:
            return val

    l.sort(key=sort_func, reverse=reverse)

    # Rearrange items in sorted order
    for index, (val, k) in enumerate(l):
        tree.move(k, '', index)

    # Reverse sort order for next click
    tree.heading(col, command=lambda: treeview_sort_column(tree, col, not reverse, data_source, display_map))
