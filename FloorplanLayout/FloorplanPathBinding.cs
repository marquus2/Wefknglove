using System.Collections.Generic;
using Shapes;
using UnityEngine;

[ExecuteAlways]
[DisallowMultipleComponent]
[AddComponentMenu("BM Identity/Floorplan/Path Binding")]
public class FloorplanPathBinding : MonoBehaviour
{
    [Header("Floorplan")]
    [Tooltip("Optional. If empty, the inspector uses the first FloorplanMasterLayout found in the open scenes.")]
    public FloorplanMasterLayout masterLayout;

    [Tooltip("Path id from the SAMBO JSON. For regular connections this is usually the connection id.")]
    public string pathId;

    [Tooltip("Alternate content id, used for AC generated paths.")]
    public string alternateContentId;

    [Tooltip("Route key from SAMBO, for example bm010->bm020.")]
    public string routeKey;

    public string fromSceneId;
    public string toSceneId;

    [Tooltip("-1 means use the unified nodes array. 0-5 means use that individual lane.")]
    public int laneIndex = -1;

    [Header("Polyline")]
    public Polyline polyline;
    public bool forceOpenPolyline = true;
    public bool preserveExistingPointColor = true;
    public Color fallbackPointColor = Color.white;
    [Min(0f)] public float fallbackPointThickness = 1f;

    private void Reset()
    {
        polyline = GetComponent<Polyline>();
        if (polyline == null)
            polyline = GetComponentInChildren<Polyline>(true);
    }

    private void OnValidate()
    {
        if (polyline == null)
            polyline = GetComponent<Polyline>() ?? GetComponentInChildren<Polyline>(true);
    }

    public bool Matches(string id, string acId, string key, string from, string to)
    {
        if (!string.IsNullOrEmpty(pathId) && !string.IsNullOrEmpty(id) && pathId == id) return true;
        if (!string.IsNullOrEmpty(routeKey) && !string.IsNullOrEmpty(key) && routeKey == key) return true;
        if (!string.IsNullOrEmpty(alternateContentId) && !string.IsNullOrEmpty(acId) && alternateContentId == acId)
            return string.IsNullOrEmpty(routeKey) || routeKey == key;

        return !string.IsNullOrEmpty(fromSceneId) && !string.IsNullOrEmpty(toSceneId) &&
               fromSceneId == from && toSceneId == to;
    }

    public void ApplyWorldNodes(IReadOnlyList<Vector3> worldNodes)
    {
        if (polyline == null)
            polyline = GetComponent<Polyline>() ?? GetComponentInChildren<Polyline>(true);

        if (polyline == null || worldNodes == null || worldNodes.Count == 0)
            return;

        var points = new List<PolylinePoint>(worldNodes.Count);
        for (int i = 0; i < worldNodes.Count; i++)
        {
            Color color = fallbackPointColor;
            float thickness = fallbackPointThickness;

            if (preserveExistingPointColor && i < polyline.points.Count)
            {
                color = polyline.points[i].color;
                thickness = polyline.points[i].thickness;
            }

            Vector3 local = polyline.transform.InverseTransformPoint(worldNodes[i]);
            points.Add(new PolylinePoint(local, color, thickness));
        }

        polyline.SetPoints(points);
        if (forceOpenPolyline)
            polyline.Closed = false;
    }

    public List<Vector3> GetWorldNodes()
    {
        var nodes = new List<Vector3>();
        if (polyline == null)
            polyline = GetComponent<Polyline>() ?? GetComponentInChildren<Polyline>(true);

        if (polyline == null)
            return nodes;

        for (int i = 0; i < polyline.points.Count; i++)
            nodes.Add(polyline.transform.TransformPoint(polyline.points[i].point));

        return nodes;
    }
}
