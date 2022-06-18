import React from 'react';
import {TouchableOpacity, Text, Image} from 'react-native';
import {Grayscale} from 'react-native-color-matrix-image-filters';

import {COLORS, SIZES, FONTS, SHADOWS} from '../constants';

export const CircleButton = ({
  imgUrl,
  handlePressDown,
  handlePressUp,
  size,
  ...props
}) => {
  return (
    <TouchableOpacity
      style={{
        width: 60,
        height: 60,
        backgroundColor: '#427ef5',
        borderRadius: 100,
        alignItems: 'center',
        justifyContent: 'center',
        ...props,
      }}
      onPressIn={handlePressDown}
      onPressOut={handlePressUp}>
      <Image
        key={new Date()}
        source={imgUrl}
        resizeMode="contain"
        style={{width: size[0], height: size[1]}}
      />
    </TouchableOpacity>
  );
};

export const RectButton = ({
  width,
  fontSize,
  handlePressDown,
  handlePressUp,
  text,
  ...props
}) => {
  return (
    <TouchableOpacity
      style={{
        backgroundColor: COLORS.primary,
        borderRadius: SIZES.large,
        width: width,
        height: 60,
        justifyContent: 'center',
        ...props,
      }}
      onPressIn={handlePressDown}
      onPressOut={handlePressUp}>
      <Text
        style={{
          fontFamily: FONTS.regular,
          fontSize: fontSize,
          color: COLORS.white,
          textAlign: 'center',
        }}>
        {text}
      </Text>
    </TouchableOpacity>
  );
};

export const ImageRectButton = ({
  handlePressDown,
  handlePressUp,
  img,
  size,
  ...props
}) => {
  return (
    <TouchableOpacity
      style={{
        backgroundColor: COLORS.primary,
        borderRadius: SIZES.large,
        width: size[0],
        height: 100,
        justifyContent: 'center',
        alignItems: 'center',
        ...SHADOWS.dark,
        ...props,
      }}
      onPressIn={handlePressDown}
      onPressOut={handlePressUp}>
      <Image
        source={img}
        resizeMode="contain"
        style={{width: size[0], height: size[1]}}
      />
    </TouchableOpacity>
  );
};
