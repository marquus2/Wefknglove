using System;
using UnityEngine;

[Serializable]
public class FloorplanCoordinateSettings
{
    public enum Plane
    {
        XZ,
        XY
    }

    [Header("Units")]
    [Min(0.0001f)] public float metersToUnity = 1f;
    public Vector2 jsonOriginMeters = Vector2.zero;
    public Vector3 unityOrigin = Vector3.zero;

    [Header("Plane")]
    public Plane targetPlane = Plane.XZ;
    public bool invertJsonY = false;
    public bool preserveCurrentHeight = true;
    public float fixedHeight = 0f;

    [Header("Rotation")]
    public float yawOffsetDegrees = 0f;
    public bool invertRotation = false;

    public Vector3 JsonPointToWorld(float xMeters, float yMeters, float currentHeight)
    {
        float x = (xMeters - jsonOriginMeters.x) * metersToUnity;
        float y = (yMeters - jsonOriginMeters.y) * metersToUnity;
        if (invertJsonY) y = -y;

        float height = preserveCurrentHeight ? currentHeight : fixedHeight;
        return targetPlane == Plane.XY
            ? unityOrigin + new Vector3(x, y, height)
            : unityOrigin + new Vector3(x, height, y);
    }

    public Vector2 WorldPointToJson(Vector3 world)
    {
        Vector3 local = world - unityOrigin;
        float x = local.x / metersToUnity + jsonOriginMeters.x;
        float y = (targetPlane == Plane.XY ? local.y : local.z) / metersToUnity;
        if (invertJsonY) y = -y;
        y += jsonOriginMeters.y;
        return new Vector2(x, y);
    }

    public Quaternion JsonYawToWorldRotation(float dirDegrees)
    {
        float yaw = invertRotation ? -dirDegrees : dirDegrees;
        yaw += yawOffsetDegrees;
        return targetPlane == Plane.XY
            ? Quaternion.Euler(0f, 0f, yaw)
            : Quaternion.Euler(0f, yaw, 0f);
    }

    public float WorldRotationToJsonYaw(Quaternion rotation)
    {
        float angle = targetPlane == Plane.XY ? rotation.eulerAngles.z : rotation.eulerAngles.y;
        angle -= yawOffsetDegrees;
        if (invertRotation) angle = -angle;
        angle %= 360f;
        if (angle < 0f) angle += 360f;
        return angle;
    }
}
